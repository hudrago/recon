import { describe, expect, it } from 'vitest';
import {
  {{provider}}{{capability}}EdgeCaseFixture,
  {{provider}}{{capability}}Fixture,
} from './__fixtures__/{{capability}}.fixture';
import { map{{Provider}}{{Capability}}ToDomain } from './{{capabilityFileName}}';

describe('map{{Provider}}{{Capability}}ToDomain', () => {
  it('maps the common-case fixture to the expected domain shape', () => {
    expect(map{{Provider}}{{Capability}}ToDomain({{provider}}{{capability}}Fixture, 'org_1')).toEqual({
      // expected domain object
    });
  });

  it('maps the edge-case fixture without throwing', () => {
    expect(() =>
      map{{Provider}}{{Capability}}ToDomain({{provider}}{{capability}}EdgeCaseFixture, 'org_1'),
    ).not.toThrow();
  });
});
