// Writes FHIR R4 Bundles for the demo records to fhir/examples/, for the HL7 validator.
// Usage: npm run fhir:examples   then   npm run fhir:validate
import { mkdirSync, writeFileSync } from 'node:fs';
import { tandemCodeSystems, toFhirBundle } from '../src/core/fhir';
import { demoRecords } from '../src/data/demo';

mkdirSync('fhir/examples', { recursive: true });
for (const r of demoRecords()) {
  const path = `fhir/examples/${r.id}.json`;
  writeFileSync(path, JSON.stringify(toFhirBundle(r), null, 2) + '\n');
  console.log(path);
}

mkdirSync('fhir/terminology', { recursive: true });
for (const cs of tandemCodeSystems()) {
  const path = `fhir/terminology/CodeSystem-${cs.id}.json`;
  writeFileSync(path, JSON.stringify(cs, null, 2) + '\n');
  console.log(path);
}
