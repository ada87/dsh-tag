import { rm } from 'node:fs/promises'

/** Remove generated output so stale files never leak into the npm tarball. */
await rm('lib', { recursive: true, force: true })
