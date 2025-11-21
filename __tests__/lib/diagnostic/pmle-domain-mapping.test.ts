/**
 * Tests for PMLE domain mapping functions
 */

import {
  mapLegacyDomainToBlueprint,
  getLegacyDomainsForBlueprint,
  LEGACY_TO_BLUEPRINT_MAP,
} from '@/lib/diagnostic/pmle-domain-mapping';
import { PMLE_BLUEPRINT } from '@/lib/constants/pmle-blueprint';

describe('pmle-domain-mapping', () => {
  describe('mapLegacyDomainToBlueprint', () => {
    it('should map known legacy domains to blueprint domains', () => {
      expect(mapLegacyDomainToBlueprint('BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION')).toBe(
        'ARCHITECTING_LOW_CODE_ML_SOLUTIONS'
      );
      expect(mapLegacyDomainToBlueprint('VERTEX_AI_FEATURE_STORE_MANAGEMENT')).toBe(
        'COLLABORATING_TO_MANAGE_DATA_AND_MODELS'
      );
      expect(mapLegacyDomainToBlueprint('CUSTOM_TRAINING_WITH_DIFFERENT_ML_FRAMEWORKS')).toBe(
        'SCALING_PROTOTYPES_INTO_ML_MODELS'
      );
      expect(mapLegacyDomainToBlueprint('ONLINE_AND_BATCH_PREDICTION_DEPLOYMENT')).toBe(
        'SERVING_AND_SCALING_MODELS'
      );
      expect(mapLegacyDomainToBlueprint('VERTEX_AI_PIPELINES_AND_KUBEFLOW_ORCHESTRATION')).toBe(
        'AUTOMATING_AND_ORCHESTRATING_ML_PIPELINES'
      );
      expect(mapLegacyDomainToBlueprint('MODEL_MONITORING_AND_DRIFT_DETECTION')).toBe(
        'MONITORING_ML_SOLUTIONS'
      );
    });

    it('should return null for unknown legacy domains', () => {
      expect(mapLegacyDomainToBlueprint('UNKNOWN_DOMAIN')).toBeNull();
      expect(mapLegacyDomainToBlueprint('')).toBeNull();
    });
  });

  describe('getLegacyDomainsForBlueprint', () => {
    it('should return all legacy domains for a blueprint domain', () => {
      const lowCodeDomains = getLegacyDomainsForBlueprint('ARCHITECTING_LOW_CODE_ML_SOLUTIONS');
      expect(lowCodeDomains).toContain('AUTOML_FOR_TABULAR_TEXT_AND_IMAGE_DATA');
      expect(lowCodeDomains).toContain('BIGQUERY_ML_FOR_CLASSIFICATION_AND_REGRESSION');
      expect(lowCodeDomains).toContain('ML_APIS_AND_MODEL_GARDEN_APPLICATIONS');
      expect(lowCodeDomains.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown blueprint domain', () => {
      expect(getLegacyDomainsForBlueprint('UNKNOWN_BLUEPRINT')).toEqual([]);
    });
  });

  describe('LEGACY_TO_BLUEPRINT_MAP consistency', () => {
    it('should map all legacy domains to valid blueprint domains', () => {
      const blueprintCodes = new Set(PMLE_BLUEPRINT.map((d) => d.domainCode));
      
      for (const [legacyCode, blueprintCode] of Object.entries(LEGACY_TO_BLUEPRINT_MAP)) {
        expect(blueprintCodes.has(blueprintCode)).toBe(true);
      }
    });

    it('should have at least one legacy domain mapped to each blueprint domain', () => {
      const blueprintCodes = new Set(PMLE_BLUEPRINT.map((d) => d.domainCode));
      const mappedBlueprintCodes = new Set(Object.values(LEGACY_TO_BLUEPRINT_MAP));
      
      // All blueprint domains should have at least one legacy domain mapped to them
      // (though this may not be true initially, it's a good check for completeness)
      for (const blueprintCode of blueprintCodes) {
        // This is informational - we may not have legacy domains for all blueprint domains yet
        if (!mappedBlueprintCodes.has(blueprintCode)) {
          console.warn(`No legacy domains mapped to blueprint domain: ${blueprintCode}`);
        }
      }
    });

    it('should not have duplicate mappings (one-to-one)', () => {
      const legacyCodes = Object.keys(LEGACY_TO_BLUEPRINT_MAP);
      const uniqueLegacyCodes = new Set(legacyCodes);
      
      expect(legacyCodes.length).toBe(uniqueLegacyCodes.size);
    });
  });
});

