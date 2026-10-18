// Flow contract: a server-resolved organization controller reads authoritative organization and workforce state, creates departments, reusable groups and invitations with initial memberships, changes memberships and lifecycle state, and receives notification references. Caller-authored organization or authority data fails closed, and state survives reconstruction over the same store.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  InMemoryControllerAdministrationStore,
  OrganizationControllerGateway,
} from '../dist/index.js'

const actor = Object.freeze({
  tenantId: 'tenant:one',
  organizationReference: 'organization:one',
  employeeReference: 'employee:controller',
  active: true,
  groupReferences: ['group:controllers'],
  capabilities: [
    'controller.organization.read',
    'controller.structure.write',
    'controller.workforce.write',
  ],
})

test('persists the complete controller administration journey', async () => {
  const store = new InMemoryControllerAdministrationStore()
  const gateway = new OrganizationControllerGateway({ store })

  const initial = await gateway.readWorkspace({ actor })
  assert.equal(initial.organization.reference, 'organization:one')
  assert.equal(initial.licences.total, 5)

  const department = await gateway.createDepartment({ actor, name: 'Operations' })
  const group = await gateway.createGroup({
    actor,
    name: 'Identity reviewers',
    capabilities: ['identity.evidence.record'],
  })
  assert.match(group.authorizationReference, /^authorization:/)

  const invitation = await gateway.createInvitation({
    actor,
    email: 'reviewer@example.invalid',
    role: 'Reviewer',
    departmentReferences: [department.department.reference],
    groupReferences: [group.reference],
  })
  assert.equal(invitation.invitation.status, 'pending')
  assert.match(invitation.notificationReference, /^communication:/)

  const accepted = await gateway.acceptInvitation({
    actor,
    invitationReference: invitation.invitation.reference,
    deviceReference: 'device:reviewer:one',
  })
  assert.equal(accepted.employee.status, 'active')
  assert.deepEqual(accepted.employee.groupReferences, [group.reference])
  assert.equal(accepted.employee.deviceReferences.length, 1)

  await gateway.setEmployeeMemberships({
    actor,
    employeeReference: accepted.employee.reference,
    groupReferences: [],
    departmentReferences: [department.department.reference],
  })
  await gateway.setEmployeeStatus({ actor, employeeReference: accepted.employee.reference, status: 'inactive' })

  const reconstructed = new OrganizationControllerGateway({ store })
  const reloaded = await reconstructed.readWorkspace({ actor })
  assert.equal(reloaded.employees[0].status, 'inactive')
  assert.deepEqual(reloaded.employees[0].groupReferences, [])
  assert.equal(reloaded.notifications.length, 4)
})

test('fails closed for missing capability and caller-authored organization authority', async () => {
  const gateway = new OrganizationControllerGateway({ store: new InMemoryControllerAdministrationStore() })
  await assert.rejects(
    gateway.readWorkspace({ actor: { ...actor, capabilities: [] } }),
    /controller\.organization\.read capability is required/,
  )
  await assert.rejects(
    gateway.createDepartment({ actor, name: 'Operations', organizationReference: 'organization:other' }),
    /server-owned organization authority/,
  )
})
