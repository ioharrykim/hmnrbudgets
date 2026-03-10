import { MockRepository } from "@/lib/storage/mock-repository";
import { SupabaseRepository } from "@/lib/storage/supabase-repository";
import type { PersistenceRepository } from "@/lib/storage/types";
import { hasSupabaseServerConfig } from "@/lib/env";

let repository: PersistenceRepository | null = null;

export function getRepository(): PersistenceRepository {
  if (repository) {
    return repository;
  }

  if (hasSupabaseServerConfig()) {
    repository = new SupabaseRepository();
    return repository;
  }

  repository = new MockRepository();
  return repository;
}
