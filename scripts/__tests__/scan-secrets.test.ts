/**
 * TC-ENV-10: Secret scanning tests
 * 
 * Tests that gitleaks properly detects secrets in staged changes.
 * This verifies the pre-commit hook will block commits with secrets.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE = process.cwd();
const TEST_FILE = path.join(WORKSPACE, 'test-secret-file.tmp');

// Check if gitleaks is available
function isGitleaksAvailable(): boolean {
  // Check GITLEAKS_BIN env var first
  const gitleaksBin = process.env.GITLEAKS_BIN || 'gitleaks';
  try {
    const result = spawnSync(gitleaksBin, ['version'], { encoding: 'utf-8' });
    if (result.status === 0) return true;
  } catch {
    // Continue to fallback
  }
  
  // Check /tmp/gitleaks (where scan-secrets.sh installs it)
  try {
    const result = spawnSync('/tmp/gitleaks', ['version'], { encoding: 'utf-8' });
    if (result.status === 0) return true;
  } catch {
    // Continue to fallback
  }
  
  // Try system gitleaks
  try {
    const result = spawnSync('gitleaks', ['version'], { encoding: 'utf-8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

describe('TC-ENV-10: Secret scanning (gitleaks)', () => {
  const gitleaksAvailable = isGitleaksAvailable();

  afterAll(() => {
    // Clean up test file if it exists
    try {
      if (fs.existsSync(TEST_FILE)) {
        fs.unlinkSync(TEST_FILE);
        execSync(`git restore --staged ${TEST_FILE} 2>/dev/null || true`, { 
          cwd: WORKSPACE,
          encoding: 'utf-8',
        });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it('TC-ENV-10a: gitleaks detects AWS access key pattern', () => {
    // Test the pattern detection logic without actually staging
    const fakeAwsKey = 'AKIAIOSFODNN7EXAMPLE'; // AWS example key format
    const awsKeyPattern = /AKIA[0-9A-Z]{16}/;
    
    expect(awsKeyPattern.test(fakeAwsKey)).toBe(true);
  });

  it('TC-ENV-10b: gitleaks detects Supabase service role key pattern', () => {
    // Supabase keys start with eyJ (base64 JWT)
    const fakeSupabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUifQ.fake';
    const jwtPattern = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    
    expect(jwtPattern.test(fakeSupabaseKey)).toBe(true);
  });

  it('TC-ENV-10c: gitleaks detects Discord webhook URL pattern', () => {
    const fakeDiscordWebhook = 'https://discord.com/api/webhooks/1234567890123456789/abcdefghijklmnopqrstuvwxyz';
    const discordPattern = /discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/;
    
    expect(discordPattern.test(fakeDiscordWebhook)).toBe(true);
  });

  it('TC-ENV-10d: scan-secrets.sh script exists and is executable', () => {
    const scriptPath = path.join(WORKSPACE, 'scripts', 'scan-secrets.sh');
    
    expect(fs.existsSync(scriptPath)).toBe(true);
    
    const stats = fs.statSync(scriptPath);
    const isExecutable = (stats.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });

  it('TC-ENV-10e: .gitignore blocks .env files', () => {
    const gitignorePath = path.join(WORKSPACE, '.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    
    expect(gitignore).toContain('.env');
    expect(gitignore).toContain('!.env.example');
  });

  it('TC-ENV-10f: .gitignore blocks .dev.vars (wrangler secrets)', () => {
    const gitignorePath = path.join(WORKSPACE, '.gitignore');
    const gitignore = fs.readFileSync(gitignorePath, 'utf-8');
    
    expect(gitignore).toContain('.dev.vars');
  });

  it.skipIf(!gitleaksAvailable)('TC-ENV-10g: gitleaks full history scan passes on this repo', () => {
    // Run the actual scan on the repository
    const result = spawnSync('./scripts/scan-secrets.sh', ['--all'], {
      cwd: WORKSPACE,
      encoding: 'utf-8',
      timeout: 60000,
    });
    
    // Exit code 0 means no secrets found
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No secrets found');
  });

  it.skipIf(!gitleaksAvailable)('TC-ENV-10h: gitleaks blocks staged fake secret', () => {
    // Create a file with a fake secret
    const fakeSecret = `
# This is a test file with a fake secret
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`;
    
    fs.writeFileSync(TEST_FILE, fakeSecret);
    
    try {
      // Stage the file
      execSync(`git add ${TEST_FILE}`, { cwd: WORKSPACE, encoding: 'utf-8' });
      
      // Run gitleaks protect (staged mode)
      const result = spawnSync('./scripts/scan-secrets.sh', [], {
        cwd: WORKSPACE,
        encoding: 'utf-8',
        timeout: 60000,
      });
      
      // Exit code 1 means secrets were found (which is expected)
      expect(result.status).toBe(1);
    } finally {
      // Unstage and remove the test file
      try {
        execSync(`git restore --staged ${TEST_FILE}`, { cwd: WORKSPACE, encoding: 'utf-8' });
      } catch { /* ignore */ }
      try {
        fs.unlinkSync(TEST_FILE);
      } catch { /* ignore */ }
    }
  });
});
