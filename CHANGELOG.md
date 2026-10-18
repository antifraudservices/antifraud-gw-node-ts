# Changelog

## Unreleased

- Add authenticated organization-controller administration for licences,
  invitations, employees, registered devices, groups, departments, reusable
  authorizations, memberships, lifecycle and Communication notifications.
- Add HTTP routes and reconstruction tests proving authoritative readback from
  the controller store without browser-owned organization authority.

- Add the executable neutral evidence gateway with authenticated HTTP routes.
- Add server-authorized employee identity evidence, including age-over
  predicates, with privacy-minimized `identity-global` anchors.
- Add education qualification employer attestations, governed EU and North
  American routing, addressed issuer inboxes and issuer decisions.
- Reject browser-supplied actor, zone, channel and smart-contract authority.
- Add in-memory ledger, confidential-vault and addressed-index adapters for
  local contract testing. These adapters are not Fabric evidence.
- Add an unauthenticated liveness route and a synthetic local server fixture
  for the controller UI to backend-for-frontend to SDK to gateway journey.
