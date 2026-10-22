import type { WorkforceActor } from './index.js'
import {
  buildPublicOrganizationServiceCatalog,
  type PublicOrganizationServiceCatalog,
} from 'antifraud-data-utils-ts/organization-service-catalog'

export type ControllerEmployeeStatus = 'active' | 'inactive'

export type ControllerOrganization = Readonly<{
  reference: string
  displayName: string
  legalIdentifier?: string
  jurisdiction?: string
}>

export type ControllerDepartment = Readonly<{ reference: string; name: string }>
export type ControllerPlace = Readonly<{
  reference: string
  name: string
  departmentReference: string
  containedInPlaceReference?: string
  geo?: Readonly<{ latitude: number; longitude: number; elevation?: number }>
  publishInCatalog: boolean
}>
export type ControllerClientService = Readonly<{
  reference: string
  name: string
  description?: string
  serviceType: string
  departmentReference: string
  placeReferences: readonly string[]
  publishInCatalog: boolean
}>
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
  places: readonly ControllerPlace[]
  services: readonly ControllerClientService[]
  catalog: Readonly<{ version: number; modifiedAt?: string }>
  groups: readonly ControllerGroup[]
  invitations: readonly ControllerInvitation[]
  employees: readonly ControllerEmployee[]
  notifications: readonly ControllerNotification[]
}>

export type ControllerWorkspacePersistenceState = {
  organization: ControllerOrganization
  licenceTotal: number
  departments: ControllerDepartment[]
  places: ControllerPlace[]
  services: ControllerClientService[]
  catalogVersion: number
  catalogIssuedAt?: string
  catalogModifiedAt?: string
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
  readonly #catalog?: Readonly<{
    jurisdiction: string
    sector: string
    accessUrl: string
    mediaType?: 'application/vnd.api+json' | 'application/ld+json'
  }>

  constructor(input: {
    store: ControllerAdministrationStore
    clock?: () => string
    catalog?: Readonly<{
      jurisdiction: string
      sector: string
      accessUrl: string
      mediaType?: 'application/vnd.api+json' | 'application/ld+json'
    }>
  }) {
    this.#store = input.store
    this.#clock = input.clock ?? (() => new Date().toISOString())
    this.#catalog = input.catalog
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

  async createPlace(input: {
    actor: WorkforceActor
    name: string
    departmentReference: string
    containedInPlaceReference?: string
    geo?: Readonly<{ latitude: number; longitude: number; elevation?: number }>
    organizationReference?: unknown
  }): Promise<{ place: ControllerPlace }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.structure.write')
    const state = await this.#state(input.actor)
    const departmentReference = verifyReference(input.departmentReference, state.departments, 'department')
    const containedInPlaceReference = input.containedInPlaceReference
      ? verifyReference(input.containedInPlaceReference, state.places, 'place')
      : undefined
    if (containedInPlaceReference) {
      const parent = state.places.find(item => item.reference === containedInPlaceReference)
      if (parent?.departmentReference !== departmentReference) throw new Error('A parent place must belong to the same department.')
    }
    const place: ControllerPlace = {
      reference: nextReference(state, 'place'),
      name: requireText(input.name, 'Place name'),
      departmentReference,
      ...(containedInPlaceReference ? { containedInPlaceReference } : {}),
      ...(input.geo ? { geo: normalizeGeo(input.geo) } : {}),
      publishInCatalog: false,
    }
    state.places.push(place)
    await this.#save(input.actor, state)
    return { place }
  }

  async createClientService(input: {
    actor: WorkforceActor
    name: string
    description?: string
    serviceType: string
    departmentReference: string
    placeReferences: readonly string[]
    organizationReference?: unknown
  }): Promise<{ service: ControllerClientService }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.structure.write')
    const state = await this.#state(input.actor)
    const departmentReference = verifyReference(input.departmentReference, state.departments, 'department')
    const placeReferences = verifyReferences(input.placeReferences, state.places, 'place')
    if (placeReferences.length === 0) throw new Error('At least one place is required.')
    if (placeReferences.some(reference => state.places.find(place => place.reference === reference)?.departmentReference !== departmentReference)) {
      throw new Error('Every service place must belong to the selected department.')
    }
    const service: ControllerClientService = {
      reference: nextReference(state, 'service'),
      name: requireText(input.name, 'Service name'),
      ...(input.description ? { description: requireText(input.description, 'Service description') } : {}),
      serviceType: requireReference(input.serviceType, 'serviceType'),
      departmentReference,
      placeReferences,
      publishInCatalog: false,
    }
    state.services.push(service)
    await this.#save(input.actor, state)
    return { service }
  }

  async setPlaceCatalogPublication(input: {
    actor: WorkforceActor
    placeReference: string
    publishInCatalog: boolean
    organizationReference?: unknown
  }): Promise<{ place: ControllerPlace }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.catalog.publish')
    const state = await this.#state(input.actor)
    const index = state.places.findIndex(place => place.reference === input.placeReference)
    if (index < 0) throw new Error('Place was not found in the authenticated organization.')
    if (!input.publishInCatalog && state.services.some(service => service.publishInCatalog && service.placeReferences.includes(input.placeReference))) {
      throw new Error('A place used by a public service cannot be made private.')
    }
    state.places[index] = { ...state.places[index], publishInCatalog: requireBoolean(input.publishInCatalog) }
    touchCatalog(state, this.#clock())
    this.#buildCatalog(state)
    await this.#save(input.actor, state)
    return { place: state.places[index] }
  }

  async setClientServiceCatalogPublication(input: {
    actor: WorkforceActor
    serviceReference: string
    publishInCatalog: boolean
    organizationReference?: unknown
  }): Promise<{ service: ControllerClientService }> {
    rejectOrganizationSelection(input)
    requireController(input.actor, 'controller.catalog.publish')
    const state = await this.#state(input.actor)
    const index = state.services.findIndex(service => service.reference === input.serviceReference)
    if (index < 0) throw new Error('Service was not found in the authenticated organization.')
    state.services[index] = { ...state.services[index], publishInCatalog: requireBoolean(input.publishInCatalog) }
    touchCatalog(state, this.#clock())
    this.#buildCatalog(state)
    await this.#save(input.actor, state)
    return { service: state.services[index] }
  }

  async readPublishedServiceCatalog(input: { actor: WorkforceActor }): Promise<PublicOrganizationServiceCatalog> {
    requireController(input.actor, 'controller.organization.read')
    return this.#buildCatalog(await this.#state(input.actor))
  }

  async readPublicServiceCatalog(organizationReference: string): Promise<PublicOrganizationServiceCatalog> {
    const normalizedReference = requireReference(organizationReference, 'organizationReference')
    const state = await this.#store.read(normalizedReference)
    if (!state) throw new Error('Published organization service catalog was not found.')
    return this.#buildCatalog(normalizePersistedState(state))
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
    if (existing) return normalizePersistedState(existing)
    const created: ControllerWorkspacePersistenceState = {
      organization: { reference: actor.organizationReference, displayName: 'Organization' },
      licenceTotal: 5, departments: [], places: [], services: [], catalogVersion: 0,
      groups: [], invitations: [], employees: [], notifications: [], sequence: 0,
    }
    await this.#store.write(actor.organizationReference, created)
    return created
  }

  async #save(actor: WorkforceActor, state: ControllerWorkspacePersistenceState): Promise<void> {
    await this.#store.write(actor.organizationReference, state)
  }

  #buildCatalog(state: ControllerWorkspacePersistenceState): PublicOrganizationServiceCatalog {
    if (!this.#catalog) throw new Error('Organization service catalog is not configured.')
    if (state.catalogVersion < 1 || !state.catalogIssuedAt || !state.catalogModifiedAt) {
      throw new Error('Organization service catalog has not been published.')
    }
    const publicDepartmentReferences = new Set([
      ...state.places.filter(place => place.publishInCatalog).map(place => place.departmentReference),
      ...state.services.filter(service => service.publishInCatalog).map(service => service.departmentReference),
    ])
    return buildPublicOrganizationServiceCatalog({
      datasetId: `catalog:${state.organization.reference}`,
      version: state.catalogVersion,
      issuedAt: state.catalogIssuedAt,
      modifiedAt: state.catalogModifiedAt,
      jurisdiction: this.#catalog.jurisdiction,
      sector: this.#catalog.sector,
      publisher: { id: state.organization.reference, name: state.organization.displayName, publishInCatalog: true },
      departments: state.departments.map(department => ({
        id: department.reference,
        name: department.name,
        publishInCatalog: publicDepartmentReferences.has(department.reference),
      })),
      places: state.places.map(place => ({
        id: place.reference,
        departmentId: place.departmentReference,
        name: place.name,
        publishInCatalog: place.publishInCatalog,
        ...(place.containedInPlaceReference ? { containedInPlaceId: place.containedInPlaceReference } : {}),
        ...(place.geo ? { geo: place.geo } : {}),
      })),
      services: state.services.map(service => ({
        id: service.reference,
        departmentId: service.departmentReference,
        name: service.name,
        ...(service.description ? { description: service.description } : {}),
        serviceType: service.serviceType,
        placeIds: service.placeReferences,
        publishInCatalog: service.publishInCatalog,
      })),
      distribution: {
        accessUrl: this.#catalog.accessUrl,
        mediaType: this.#catalog.mediaType ?? 'application/vnd.api+json',
      },
    })
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

function verifyReference<T extends { reference: string }>(value: string, available: readonly T[], label: string): string {
  return verifyReferences([value], available, label)[0]
}

function requireBoolean(value: boolean): boolean {
  if (typeof value !== 'boolean') throw new Error('Catalog publication state must be boolean.')
  return value
}

function normalizeGeo(value: Readonly<{ latitude: number; longitude: number; elevation?: number }>): Readonly<{ latitude: number; longitude: number; elevation?: number }> {
  if (!Number.isFinite(value.latitude) || value.latitude < -90 || value.latitude > 90) throw new Error('Place latitude is invalid.')
  if (!Number.isFinite(value.longitude) || value.longitude < -180 || value.longitude > 180) throw new Error('Place longitude is invalid.')
  if (value.elevation !== undefined && !Number.isFinite(value.elevation)) throw new Error('Place elevation is invalid.')
  return Object.freeze({ latitude: value.latitude, longitude: value.longitude, ...(value.elevation === undefined ? {} : { elevation: value.elevation }) })
}

function touchCatalog(state: ControllerWorkspacePersistenceState, recordedAt: string): void {
  state.catalogVersion += 1
  state.catalogIssuedAt ??= recordedAt
  state.catalogModifiedAt = recordedAt
}

function normalizePersistedState(state: ControllerWorkspacePersistenceState): ControllerWorkspacePersistenceState {
  return {
    ...state,
    places: state.places ?? [],
    services: state.services ?? [],
    catalogVersion: state.catalogVersion ?? 0,
  }
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
    places: state.places,
    services: state.services,
    catalog: { version: state.catalogVersion, ...(state.catalogModifiedAt ? { modifiedAt: state.catalogModifiedAt } : {}) },
    groups: state.groups,
    invitations: state.invitations,
    employees: state.employees,
    notifications: state.notifications,
  })
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase()
}
