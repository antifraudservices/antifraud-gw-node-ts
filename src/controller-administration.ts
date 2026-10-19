import type { WorkforceActor } from './index.js'

export type ControllerEmployeeStatus = 'active' | 'inactive'

export type ControllerOrganization = Readonly<{
  reference: string
  displayName: string
  legalIdentifier?: string
  jurisdiction?: string
}>

export type ControllerDepartment = Readonly<{ reference: string; name: string }>
export type ControllerGroup = Readonly<{
  reference: string
  name: string
  capabilities: readonly string[]
  authorizationReference: string
}>
export type ControllerInvitation = Readonly<{
  reference: string
  email: string
  role: string
  status: 'pending' | 'accepted' | 'cancelled'
  departmentReferences: readonly string[]
  groupReferences: readonly string[]
}>
export type ControllerEmployee = Readonly<{
  reference: string
  email: string
  role: string
  status: ControllerEmployeeStatus
  licenceReference: string
  departmentReferences: readonly string[]
  groupReferences: readonly string[]
  deviceReferences: readonly string[]
}>
export type ControllerNotification = Readonly<{
  reference: string
  recipientReference: string
  event: 'invitation-created' | 'invitation-accepted' | 'memberships-changed' | 'status-changed'
  recordedAt: string
}>
export type ControllerWorkspaceState = Readonly<{
  organization: ControllerOrganization
  licences: Readonly<{ total: number; assigned: number; free: number }>
  departments: readonly ControllerDepartment[]
  groups: readonly ControllerGroup[]
  invitations: readonly ControllerInvitation[]
  employees: readonly ControllerEmployee[]
  notifications: readonly ControllerNotification[]
}>

export type ControllerWorkspacePersistenceState = {
  organization: ControllerOrganization
  licenceTotal: number
  departments: ControllerDepartment[]
  groups: ControllerGroup[]
  invitations: ControllerInvitation[]
  employees: ControllerEmployee[]
  notifications: ControllerNotification[]
  sequence: number
}

export interface ControllerAdministrationStore {
  read(organizationReference: string): Promise<ControllerWorkspacePersistenceState | undefined>
  write(organizationReference: string, state: ControllerWorkspacePersistenceState): Promise<void>
}

export class InMemoryControllerAdministrationStore implements ControllerAdministrationStore {
  readonly #states = new Map<string, ControllerWorkspacePersistenceState>()

  async read(organizationReference: string): Promise<ControllerWorkspacePersistenceState | undefined> {
    const state = this.#states.get(organizationReference)
    return state ? structuredClone(state) : undefined
  }

  async write(organizationReference: string, state: ControllerWorkspacePersistenceState): Promise<void> {
    this.#states.set(organizationReference, structuredClone(state))
  }
}

export class OrganizationControllerGateway {
  readonly #store: ControllerAdministrationStore
  readonly #clock: () => string

  constructor(input: { store: ControllerAdministrationStore; clock?: () => string }) {
    this.#store = input.store
    this.#clock = input.clock ?? (() => new Date().toISOString())
  }

  async readWorkspace(input: { actor: WorkforceActor }): Promise<ControllerWorkspaceState> {
    requireController(input.actor, 'controller.organization.read')
    return project(await this.#state(input.actor))
  }

  async createDepartment(input: { actor: WorkforceActor; name: string; organizationReference?: unknown }): Promise<{ department: ControllerDepartment }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.structure.write')
    const state = await this.#state(input.actor)
    const name = requireText(input.name, 'Department name')
    if (state.departments.some(item => normalize(item.name) === normalize(name))) throw new Error('Department name already exists.')
    const department = { reference: nextReference(state, 'department'), name }
    state.departments.push(department)
    await this.#save(input.actor, state)
    return { department }
  }

  async createGroup(input: { actor: WorkforceActor; name: string; capabilities: readonly string[]; organizationReference?: unknown }): Promise<ControllerGroup> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.structure.write')
    const state = await this.#state(input.actor)
    const name = requireText(input.name, 'Group name')
    const capabilities = uniqueReferences(input.capabilities, 'capability')
    if (state.groups.some(item => normalize(item.name) === normalize(name))) throw new Error('Group name already exists.')
    const reference = nextReference(state, 'group')
    const group = { reference, name, capabilities, authorizationReference: `authorization:${reference}` }
    state.groups.push(group)
    await this.#save(input.actor, state)
    return group
  }

  async createInvitation(input: {
    actor: WorkforceActor
    email: string
    role: string
    departmentReferences: readonly string[]
    groupReferences: readonly string[]
    organizationReference?: unknown
  }): Promise<{ invitation: ControllerInvitation; notificationReference: string }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.workforce.write')
    const state = await this.#state(input.actor)
    if (assignedCount(state) >= state.licenceTotal) throw new Error('No free licences are available.')
    const email = requireEmail(input.email)
    const departmentReferences = verifyReferences(input.departmentReferences, state.departments, 'department')
    const groupReferences = verifyReferences(input.groupReferences, state.groups, 'group')
    const invitation: ControllerInvitation = {
      reference: nextReference(state, 'invitation'), email, role: requireText(input.role, 'Role'), status: 'pending',
      departmentReferences, groupReferences,
    }
    state.invitations.push(invitation)
    const notificationReference = notify(state, invitation.reference, 'invitation-created', this.#clock())
    await this.#save(input.actor, state)
    return { invitation, notificationReference }
  }

  async acceptInvitation(input: { actor: WorkforceActor; invitationReference: string; deviceReference: string; organizationReference?: unknown }): Promise<{ employee: ControllerEmployee; notificationReference: string }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.workforce.write')
    const state = await this.#state(input.actor)
    const index = state.invitations.findIndex(item => item.reference === input.invitationReference)
    const invitation = state.invitations[index]
    if (!invitation || invitation.status !== 'pending') throw new Error('A pending invitation is required.')
    const employee: ControllerEmployee = {
      reference: nextReference(state, 'employee'), email: invitation.email, role: invitation.role, status: 'active',
      licenceReference: nextReference(state, 'licence'), departmentReferences: invitation.departmentReferences,
      groupReferences: invitation.groupReferences, deviceReferences: [requireReference(input.deviceReference, 'deviceReference')],
    }
    state.employees.push(employee)
    state.invitations[index] = { ...invitation, status: 'accepted' }
    const notificationReference = notify(state, employee.reference, 'invitation-accepted', this.#clock())
    await this.#save(input.actor, state)
    return { employee, notificationReference }
  }

  async setEmployeeMemberships(input: { actor: WorkforceActor; employeeReference: string; groupReferences: readonly string[]; departmentReferences: readonly string[]; organizationReference?: unknown }): Promise<{ employee: ControllerEmployee; notificationReference: string }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.structure.write')
    const state = await this.#state(input.actor)
    const index = employeeIndex(state, input.employeeReference)
    const employee = {
      ...state.employees[index],
      groupReferences: verifyReferences(input.groupReferences, state.groups, 'group'),
      departmentReferences: verifyReferences(input.departmentReferences, state.departments, 'department'),
    }
    state.employees[index] = employee
    const notificationReference = notify(state, employee.reference, 'memberships-changed', this.#clock())
    await this.#save(input.actor, state)
    return { employee, notificationReference }
  }

  async setEmployeeStatus(input: { actor: WorkforceActor; employeeReference: string; status: ControllerEmployeeStatus; organizationReference?: unknown }): Promise<{ employee: ControllerEmployee; notificationReference: string }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.workforce.write')
    const state = await this.#state(input.actor)
    const index = employeeIndex(state, input.employeeReference)
    if (!['active', 'inactive'].includes(input.status)) throw new Error('Employee status must be active or inactive.')
    const employee = { ...state.employees[index], status: input.status }
    state.employees[index] = employee
    const notificationReference = notify(state, employee.reference, 'status-changed', this.#clock())
    await this.#save(input.actor, state)
    return { employee, notificationReference }
  }

  async purgeEmployee(input: { actor: WorkforceActor; employeeReference: string; organizationReference?: unknown }): Promise<{ purged: true }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.workforce.write')
    const state = await this.#state(input.actor)
    const index = employeeIndex(state, input.employeeReference)
    if (state.employees[index].status !== 'inactive') throw new Error('Employee must be inactive before purge.')
    state.employees.splice(index, 1)
    await this.#save(input.actor, state)
    return { purged: true }
  }

  async #state(actor: WorkforceActor): Promise<ControllerWorkspacePersistenceState> {
    const existing = await this.#store.read(actor.organizationReference)
    if (existing) return existing
    const created: ControllerWorkspacePersistenceState = {
      organization: { reference: actor.organizationReference, displayName: 'Organization' },
      licenceTotal: 5, departments: [], groups: [], invitations: [], employees: [], notifications: [], sequence: 0,
    }
    await this.#store.write(actor.organizationReference, created)
    return created
  }

  async #save(actor: WorkforceActor, state: ControllerWorkspacePersistenceState): Promise<void> {
    await this.#store.write(actor.organizationReference, state)
  }
}

function requireController(actor: WorkforceActor, capability: string): void {
  if (!actor.active) throw new Error('An active controller assignment is required.')
  if (!actor.organizationReference?.trim()) throw new Error('A trusted organization reference is required.')
  if (!actor.groupReferences.length) throw new Error('An active controller group membership is required.')
  if (!actor.capabilities.includes(capability)) throw new Error(`The ${capability} capability is required.`)
}

function rejectOrganizationSelection(input: { organizationReference?: unknown }): void {
  if (input.organizationReference !== undefined) throw new Error('The server-owned organization authority must not be supplied by the client.')
}

function requireText(value: string, label: string): string {
  const text = value?.trim()
  if (!text) throw new Error(`${label} is required.`)
  return text
}

function requireEmail(value: string): string {
  const email = requireText(value, 'Email').toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) throw new Error('A valid email is required.')
  return email
}

function requireReference(value: string, label: string): string {
  const reference = requireText(value, label)
  if (/\s/u.test(reference)) throw new Error(`${label} must be an opaque reference.`)
  return reference
}

function uniqueReferences(values: readonly string[], label: string): string[] {
  return [...new Set(values.map(value => requireReference(value, label)))]
}

function verifyReferences<T extends { reference: string }>(values: readonly string[], available: readonly T[], label: string): string[] {
  const references = uniqueReferences(values, label)
  if (references.some(reference => !available.some(item => item.reference === reference))) throw new Error(`Unknown ${label} reference.`)
  return references
}

function employeeIndex(state: ControllerWorkspacePersistenceState, reference: string): number {
  const index = state.employees.findIndex(employee => employee.reference === reference)
  if (index < 0) throw new Error('Employee was not found in the authenticated organization.')
  return index
}

function nextReference(state: ControllerWorkspacePersistenceState, kind: string): string {
  state.sequence += 1
  return `${kind}:${state.sequence.toString(16).padStart(12, '0')}`
}

function notify(state: ControllerWorkspacePersistenceState, recipientReference: string, event: ControllerNotification['event'], recordedAt: string): string {
  const reference = nextReference(state, 'communication')
  state.notifications.push({ reference, recipientReference, event, recordedAt })
  return reference
}

function assignedCount(state: ControllerWorkspacePersistenceState): number {
  return state.employees.length + state.invitations.filter(item => item.status === 'pending').length + 1
}

function project(state: ControllerWorkspacePersistenceState): ControllerWorkspaceState {
  const assigned = assignedCount(state)
  return structuredClone({
    organization: state.organization,
    licences: { total: state.licenceTotal, assigned, free: Math.max(0, state.licenceTotal - assigned) },
    departments: state.departments,
    groups: state.groups,
    invitations: state.invitations,
    employees: state.employees,
    notifications: state.notifications,
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}
