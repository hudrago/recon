const ENCODED_ROUTE_PREFIX = 'b64_';

export function encodeExceptionRouteId(exceptionId: string) {
  return `${ENCODED_ROUTE_PREFIX}${Buffer.from(exceptionId, 'utf8').toString('base64url')}`;
}

export function decodeExceptionRouteId(routeId: string) {
  if (!routeId.startsWith(ENCODED_ROUTE_PREFIX)) return routeId;
  return Buffer.from(routeId.slice(ENCODED_ROUTE_PREFIX.length), 'base64url').toString('utf8');
}