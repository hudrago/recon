// import the target domain entity, e.g. { Invoice } from '../../../domain/src/entities';

interface {{Provider}}{{Capability}}Payload {
  // only the fields you actually use
}

// STUB — verify field names against the live {{Provider}} API before production use.
export function map{{Provider}}{{Capability}}ToDomain(
  payload: {{Provider}}{{Capability}}Payload,
  orgId: string,
) {
  return {
    // map payload fields onto the target domain entity, including orgId
  };
}
