/** Truthful default: persisted composition does not supply missing authority adapters. */
import { createRepositoryContentBundleReader } from "../v1/repositoryAuthority";
import { createContentBundleRepository, withPersistentComposition, type BundleDatabase } from "./repository";
export function createPersistentRepositoryReader(db: BundleDatabase, schoolId: string) {
  return withPersistentComposition(createRepositoryContentBundleReader({
    readComposition: async () => null, readRevision: async () => null,
    readCurriculumAuthority: async () => null, readResource: async () => null,
    readAsset: async () => null, readRendering: async () => null,
  }), createContentBundleRepository(db, schoolId));
}
