// Flow contract: a server-resolved organization controller reads authoritative organization and workforce state, creates departments, reusable groups, Places, client Services and invitations, explicitly publishes a coherent public service catalog, changes memberships and lifecycle state, and receives notification references. Caller-authored organization or authority data fails closed, and state plus catalog publication survive reconstruction over the same store.
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
    'controller.catalog.publish',
  ],
})

test('persists the complete controller administration journey', async () => {
  const store = new InMemoryControllerAdministrationStore()
  const gateway = new OrganizationControllerGateway({
    store,
    catalog: {
      jurisdiction: 'CA-BC',
      sector: 'education',
      accessUrl: 'https://catalog.example.invalid/organization/services',
    },
  })

  const initial = await gateway.readWorkspace({ actor })
  assert.equal(initial.organization.reference, 'organization:one')
  assert.equal(initial.licences.total, 5)

  const department = await gateway.createDepartment({ actor, name: 'Operations' })
  const place = await gateway.createPlace({
    actor,
    name: 'Public service point',
    departmentReference: department.department.reference,
    geo: { latitude: 49.28, longitude: -123.12 },
  })
  const privatePlace = await gateway.createPlace({
    actor,
    name: 'Internal office',
    departmentReference: department.department.reference,
  })
  const service = await gateway.createClientService({
    actor,
    name: 'Qualification assessment',
    serviceType: 'qualification-assessment',
    departmentReference: department.department.reference,
    placeReferences: [place.place.reference],
  })
  await gateway.setPlaceCatalogPublication({ actor, placeReference: place.place.reference, publishInCatalog: true })
  await gateway.setClientServiceCatalogPublication({ actor, serviceReference: service.service.reference, publishInCatalog: true })
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

  const reconstructed = new OrganizationControllerGateway({
    store,
    catalog: {
      jurisdiction: 'CA-BC',
      sector: 'education',
      accessUrl: 'https://catalog.example.invalid/organization/services',
    },
  })
  const reloaded = await reconstructed.readWorkspace({ actor })
  assert.equal(reloaded.employees[0].status, 'inactive')
  assert.deepEqual(reloaded.employees[0].groupReferences, [])
  assert.equal(reloaded.notifications.length, 4)
  assert.equal(reloaded.places.length, 2)
  assert.equal(reloaded.places[0].publishInCatalog, true)
  assert.equal(reloaded.places[1].publishInCatalog, false)
  assert.equal(reloaded.services[0].publishInCatalog, true)

  const catalog = await reconstructed.readPublishedServiceCatalog({ actor })
  assert.equal(catalog.descriptor.publisherId, actor.organizationReference)
  assert.equal(catalog.resources.some(resource => resource.id === privatePlace.place.reference), false)
  assert.equal(catalog.resources.some(resource => resource.id === service.service.reference), true)
  assert.equal(JSON.stringify(catalog).includes('HealthcareService'), false)
  assert.equal(JSON.stringify(catalog).includes('Location'), false)
})

test('requires separately authorized coherent catalog publication', async () => {
  const gateway = new OrganizationControllerGateway({
    store: new InMemoryControllerAdministrationStore(),
    catalog: {
      jurisdiction: 'CA-BC',
      sector: 'education',
      accessUrl: 'https://catalog.example.invalid/organization/services',
    },
  })
  const department = await gateway.createDepartment({ actor, name: 'Learning' })
  const place = await gateway.createPlace({
    actor, name: 'Internal room', departmentReference: department.department.reference,
  })
  const service = await gateway.createClientService({
    actor,
    name: 'Assessment',
    serviceType: 'assessment',
    departmentReference: department.department.reference,
    placeReferences: [place.place.reference],
  })

  await assert.rejects(
    gateway.setClientServiceCatalogPublication({ actor, serviceReference: service.service.reference, publishInCatalog: true }),
    /public_service_place_not_public/,
  )
  await assert.rejects(
    gateway.setPlaceCatalogPublication({
      actor: { ...actor, capabilities: actor.capabilities.filter(value => value !== 'controller.catalog.publish') },
      placeReference: place.place.reference,
      publishInCatalog: true,
    }),
    /controller\.catalog\.publish capability is required/,
  )
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
