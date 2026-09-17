import type { CarrierTrackingGateway, CarrierTrackingUpdate } from '../carrierTrackingGateway';

// No real CTT/DPD integration exists yet (see docs/architecture — CSV import is the current MVP).
// Used as the default so the tracking job/queue can be wired and tested without live carrier
// credentials; always returns no updates.
export class FakeCarrierTrackingGateway implements CarrierTrackingGateway {
  async fetchStatuses(_trackingNumbers: string[]): Promise<CarrierTrackingUpdate[]> {
    return [];
  }
}
