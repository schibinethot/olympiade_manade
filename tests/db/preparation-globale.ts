import { recreerBaseDeTest } from './aide';

export default async function preparationGlobale(): Promise<void> {
  await recreerBaseDeTest();
}
