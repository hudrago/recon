import { expect, it, vi } from 'vitest';
import type { ExceptionService } from '../exceptionService';
import { ReevaluationJob } from './reevaluation.job';

it('runs pending reevaluation using the current time', async () => {
  const reevaluatePending = vi.fn().mockResolvedValue(0);
  const job = new ReevaluationJob({ reevaluatePending } as unknown as ExceptionService);

  await job.run();

  expect(reevaluatePending).toHaveBeenCalledOnce();
  expect(reevaluatePending.mock.calls[0]?.[0]).toBeInstanceOf(Date);
});

it('does not overlap reevaluation runs', async () => {
  let finishRun: (value: number) => void = () => undefined;
  const reevaluatePending = vi.fn().mockImplementation(() => new Promise<number>((resolve) => (finishRun = resolve)));
  const job = new ReevaluationJob({ reevaluatePending } as unknown as ExceptionService);

  const firstRun = job.run();
  await job.run();
  expect(reevaluatePending).toHaveBeenCalledOnce();

  finishRun(0);
  await firstRun;
});