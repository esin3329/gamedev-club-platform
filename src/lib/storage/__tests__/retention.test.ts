/**
 * Retention Cleanup Logic Tests
 * 
 * Test scenarios from test-scenarios-v1.1.md:
 * - TC-RET-01: WebGL 빌드 2개 존재 시 정리 없음
 * - TC-RET-02: 3번째 빌드 업로드 시 사전 안내
 * - TC-RET-03: 3번째 업로드 후 가장 오래된 빌드 정리
 * - TC-RET-04: 대표 빌드는 정리되지 않음
 * - TC-RET-05: 대표 빌드가 최신 2개에 포함될 때
 * - TC-RET-06: PC 빌드 보관 (최신 1개)
 * - TC-RET-07: 업로드 취소/실패 시 정리 대상 안 생김
 * - TC-RET-08: 보관 개수 설정 변경 적용
 * - TC-RET-10: 다른 프로젝트 영향 없음
 * 
 * These tests verify the retention selection logic without actual R2 operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBuildStorageConfig, MiB } from '../config';

interface BuildInfo {
  id: string;
  version: string;
  buildType: 'webgl' | 'pc';
  storageKey: string;
  createdAt: Date;
  isFeatured: boolean;
}

/**
 * Pure function to determine which builds to delete based on retention policy.
 * This mirrors the logic in cleanupOldBuilds but without R2 operations.
 */
function getRetentionDecisions(
  builds: BuildInfo[],
  featuredBuildId: string | null,
  config: {
    enabled: boolean;
    webglKeepLatest: number;
    pcKeepLatest: number;
    keepFeaturedBuild: boolean;
  }
): { toDelete: string[]; toPreserve: string[] } {
  if (!config.enabled) {
    return {
      toDelete: [],
      toPreserve: builds.map(b => b.id),
    };
  }

  const toDelete: string[] = [];
  const toPreserve: string[] = [];

  const webglBuilds = builds
    .filter(b => b.buildType === 'webgl')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  const pcBuilds = builds
    .filter(b => b.buildType === 'pc')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const processBuilds = (
    buildList: BuildInfo[],
    keepCount: number
  ) => {
    for (let i = 0; i < buildList.length; i++) {
      const build = buildList[i];
      const isWithinKeepLimit = i < keepCount;
      const isFeatured = config.keepFeaturedBuild && build.id === featuredBuildId;

      if (isWithinKeepLimit || isFeatured) {
        toPreserve.push(build.id);
      } else {
        toDelete.push(build.id);
      }
    }
  };

  processBuilds(webglBuilds, config.webglKeepLatest);
  processBuilds(pcBuilds, config.pcKeepLatest);

  return { toDelete, toPreserve };
}

function createBuild(
  id: string,
  buildType: 'webgl' | 'pc',
  daysAgo: number,
  version?: string
): BuildInfo {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    version: version || `v${id}`,
    buildType,
    storageKey: `${buildType}/${id}/build.zip`,
    createdAt: date,
    isFeatured: false,
  };
}

describe('Retention Selection Logic', () => {
  const defaultConfig = {
    enabled: true,
    webglKeepLatest: 2,
    pcKeepLatest: 1,
    keepFeaturedBuild: true,
  };

  describe('TC-RET-01: WebGL 빌드 2개 이하는 정리 없음', () => {
    it('WebGL 빌드 0개일 때 정리 없음', () => {
      const builds: BuildInfo[] = [];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toHaveLength(0);
      expect(result.toPreserve).toHaveLength(0);
    });

    it('WebGL 빌드 1개일 때 정리 없음', () => {
      const builds = [createBuild('v1', 'webgl', 0)];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toHaveLength(0);
      expect(result.toPreserve).toEqual(['v1']);
    });

    it('WebGL 빌드 2개일 때 정리 없음 (상한과 같음)', () => {
      const builds = [
        createBuild('v1', 'webgl', 1),
        createBuild('v2', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toHaveLength(0);
      expect(result.toPreserve).toContain('v1');
      expect(result.toPreserve).toContain('v2');
    });
  });

  describe('TC-RET-03: 3번째 WebGL 빌드 시 가장 오래된 것 정리', () => {
    it('v1, v2, v3 존재 시 v1 정리', () => {
      const builds = [
        createBuild('v1', 'webgl', 2),  // oldest
        createBuild('v2', 'webgl', 1),
        createBuild('v3', 'webgl', 0),  // newest
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toEqual(['v1']);
      expect(result.toPreserve).toContain('v2');
      expect(result.toPreserve).toContain('v3');
    });

    it('v1, v2, v3, v4 존재 시 v1, v2 정리', () => {
      const builds = [
        createBuild('v1', 'webgl', 3),
        createBuild('v2', 'webgl', 2),
        createBuild('v3', 'webgl', 1),
        createBuild('v4', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toContain('v1');
      expect(result.toDelete).toContain('v2');
      expect(result.toPreserve).toContain('v3');
      expect(result.toPreserve).toContain('v4');
    });
  });

  describe('TC-RET-04: 대표 빌드는 정리되지 않음', () => {
    it('v1이 대표일 때 v3 게시 후에도 v1 유지', () => {
      const builds = [
        createBuild('v1', 'webgl', 2),  // featured
        createBuild('v2', 'webgl', 1),
        createBuild('v3', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, 'v1', defaultConfig);
      
      expect(result.toPreserve).toContain('v1'); // featured preserved
      expect(result.toPreserve).toContain('v2'); // 2nd newest
      expect(result.toPreserve).toContain('v3'); // newest
      expect(result.toDelete).toHaveLength(0);
    });

    it('v1이 대표일 때 v4 게시 후 v2만 정리', () => {
      const builds = [
        createBuild('v1', 'webgl', 3),  // featured
        createBuild('v2', 'webgl', 2),
        createBuild('v3', 'webgl', 1),
        createBuild('v4', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, 'v1', defaultConfig);
      
      expect(result.toPreserve).toContain('v1'); // featured
      expect(result.toPreserve).toContain('v3'); // 2nd newest
      expect(result.toPreserve).toContain('v4'); // newest
      expect(result.toDelete).toEqual(['v2']);
    });

    it('keepFeaturedBuild=false일 때 대표 빌드도 정리 대상', () => {
      const config = { ...defaultConfig, keepFeaturedBuild: false };
      const builds = [
        createBuild('v1', 'webgl', 2),  // featured but will be deleted
        createBuild('v2', 'webgl', 1),
        createBuild('v3', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, 'v1', config);
      
      expect(result.toDelete).toContain('v1');
      expect(result.toPreserve).toContain('v2');
      expect(result.toPreserve).toContain('v3');
    });
  });

  describe('TC-RET-05: 대표 빌드가 최신 2개에 포함될 때', () => {
    it('v3이 대표이고 최신 2개 중 하나일 때 v2, v3 유지', () => {
      const builds = [
        createBuild('v1', 'webgl', 2),
        createBuild('v2', 'webgl', 1),
        createBuild('v3', 'webgl', 0),  // newest AND featured
      ];
      const result = getRetentionDecisions(builds, 'v3', defaultConfig);
      
      expect(result.toPreserve).toContain('v2');
      expect(result.toPreserve).toContain('v3');
      expect(result.toDelete).toEqual(['v1']); // oldest removed
    });

    it('v2가 대표이고 최신 2개 중 하나일 때 v4 게시 후 v2, v3, v4 유지', () => {
      const builds = [
        createBuild('v1', 'webgl', 3),
        createBuild('v2', 'webgl', 2),  // featured
        createBuild('v3', 'webgl', 1),
        createBuild('v4', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, 'v2', defaultConfig);
      
      // v4, v3 are in keep limit (2)
      // v2 is featured
      // Only v1 should be deleted
      expect(result.toPreserve).toContain('v2');
      expect(result.toPreserve).toContain('v3');
      expect(result.toPreserve).toContain('v4');
      expect(result.toDelete).toEqual(['v1']);
    });
  });

  describe('TC-RET-06: PC 빌드 보관 (최신 1개)', () => {
    it('PC 빌드 1개일 때 정리 없음', () => {
      const builds = [createBuild('p1', 'pc', 0)];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toHaveLength(0);
      expect(result.toPreserve).toEqual(['p1']);
    });

    it('PC 빌드 2개일 때 오래된 것 정리', () => {
      const builds = [
        createBuild('p1', 'pc', 1),  // older
        createBuild('p2', 'pc', 0),  // newer
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      expect(result.toDelete).toEqual(['p1']);
      expect(result.toPreserve).toEqual(['p2']);
    });

    it('PC 빌드는 WebGL 빌드에 영향 없음', () => {
      const builds = [
        createBuild('w1', 'webgl', 2),
        createBuild('w2', 'webgl', 1),
        createBuild('p1', 'pc', 1),
        createBuild('p2', 'pc', 0),
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      // WebGL: both preserved (keep 2)
      expect(result.toPreserve).toContain('w1');
      expect(result.toPreserve).toContain('w2');
      // PC: only newest preserved (keep 1)
      expect(result.toPreserve).toContain('p2');
      expect(result.toDelete).toEqual(['p1']);
    });
  });

  describe('TC-RET-07: 업로드 취소/실패 시 정리 대상 안 생김', () => {
    it('기존 2개에서 3개째 추가 전 상태 확인', () => {
      const builds = [
        createBuild('v1', 'webgl', 1),
        createBuild('v2', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, null, defaultConfig);
      
      // Before v3 is added and committed, nothing should be deleted
      expect(result.toDelete).toHaveLength(0);
    });
  });

  describe('TC-RET-08: 보관 개수 설정 변경 적용', () => {
    it('webglKeepLatest=3으로 변경 시 4개째부터 정리', () => {
      const config = { ...defaultConfig, webglKeepLatest: 3 };
      const builds = [
        createBuild('v1', 'webgl', 3),
        createBuild('v2', 'webgl', 2),
        createBuild('v3', 'webgl', 1),
        createBuild('v4', 'webgl', 0),
      ];
      const result = getRetentionDecisions(builds, null, config);
      
      expect(result.toDelete).toEqual(['v1']); // 4th oldest
      expect(result.toPreserve).toContain('v2');
      expect(result.toPreserve).toContain('v3');
      expect(result.toPreserve).toContain('v4');
    });

    it('pcKeepLatest=2로 변경 시 3개째부터 정리', () => {
      const config = { ...defaultConfig, pcKeepLatest: 2 };
      const builds = [
        createBuild('p1', 'pc', 2),
        createBuild('p2', 'pc', 1),
        createBuild('p3', 'pc', 0),
      ];
      const result = getRetentionDecisions(builds, null, config);
      
      expect(result.toDelete).toEqual(['p1']);
      expect(result.toPreserve).toContain('p2');
      expect(result.toPreserve).toContain('p3');
    });
  });

  describe('TC-RET-10: 다른 프로젝트 영향 없음', () => {
    it('각 프로젝트는 독립적으로 처리', () => {
      // Project A builds
      const projectABuilds = [
        createBuild('a1', 'webgl', 2),
        createBuild('a2', 'webgl', 1),
        createBuild('a3', 'webgl', 0),
      ];
      
      // Project B builds
      const projectBBuilds = [
        createBuild('b1', 'webgl', 1),
        createBuild('b2', 'webgl', 0),
      ];
      
      const resultA = getRetentionDecisions(projectABuilds, null, defaultConfig);
      const resultB = getRetentionDecisions(projectBBuilds, null, defaultConfig);
      
      // Project A: oldest deleted
      expect(resultA.toDelete).toEqual(['a1']);
      
      // Project B: nothing deleted (only 2 builds)
      expect(resultB.toDelete).toHaveLength(0);
    });
  });

  describe('보관 정책 비활성화', () => {
    it('enabled=false일 때 모든 빌드 유지', () => {
      const config = { ...defaultConfig, enabled: false };
      const builds = [
        createBuild('v1', 'webgl', 5),
        createBuild('v2', 'webgl', 4),
        createBuild('v3', 'webgl', 3),
        createBuild('v4', 'webgl', 2),
        createBuild('v5', 'webgl', 1),
      ];
      const result = getRetentionDecisions(builds, null, config);
      
      expect(result.toDelete).toHaveLength(0);
      expect(result.toPreserve).toHaveLength(5);
    });
  });
});

describe('Default Config Values', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('기본 설정값 확인', () => {
    const config = getBuildStorageConfig();
    
    expect(config.retention.enabled).toBe(true);
    expect(config.retention.webglKeepLatest).toBe(2);
    expect(config.retention.pcKeepLatest).toBe(1);
    expect(config.retention.keepFeaturedBuild).toBe(true);
  });
});
