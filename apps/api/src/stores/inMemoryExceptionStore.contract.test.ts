import { InMemoryExceptionStore } from './inMemoryExceptionStore';
import { runExceptionStoreContract } from './exceptionStore.contract';

runExceptionStoreContract('InMemoryExceptionStore', () => new InMemoryExceptionStore());
