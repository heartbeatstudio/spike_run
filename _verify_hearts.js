const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  const fileUrl = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
  await page.goto(fileUrl);

  // Click through Start -> Story -> Begin Mission
  await page.click('#start-btn');
  await page.waitForTimeout(300);
  // story screen has fade-in buttons; wait then click begin
  await page.waitForSelector('#begin-btn', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.click('#begin-btn');
  await page.waitForTimeout(500);

  const hudVisible = await page.evaluate(() => !document.getElementById('hud').classList.contains('hidden'));
  console.log('HUD visible after starting Level 1:', hudVisible);

  async function readState() {
    return page.evaluate(() => ({
      currentLevel,
      deaths,
      playerHearts,
      heartsText: document.getElementById('hearts-display').textContent,
      heartsBoxHidden: document.getElementById('hearts-box').classList.contains('hidden'),
      playerX: player.x, playerY: player.y,
      gameRunning
    }));
  }

  console.log('Initial state:', await readState());
  await page.screenshot({ path: '_verify_01_level1_start.png' });

  // Walk right toward the gap-with-spikes at tile x=15-18 (player starts x=2). Hold right ~3s.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);

  console.log('After walking into gap (expect heart lost, no death):', await readState());
  await page.screenshot({ path: '_verify_02_after_first_fall.png' });

  // Walk right again to fall into the same gap a 2nd time
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  console.log('After 2nd fall (expect 1 heart left, no death):', await readState());
  await page.screenshot({ path: '_verify_03_after_second_fall.png' });

  // Walk right a 3rd time — should be the real death (deaths++, hearts reset to 3)
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  console.log('After 3rd fall (expect REAL death, deaths=1, hearts reset to 3):', await readState());
  await page.screenshot({ path: '_verify_04_after_third_fall_real_death.png' });

  // Now jump to the Level 10 boss level via the debug menu (type "debug")
  await page.keyboard.type('debug', { delay: 50 });
  await page.waitForTimeout(300);
  const levelSelectVisible = await page.evaluate(() => !document.getElementById('level-select').classList.contains('hidden'));
  console.log('Level select (debug menu) visible:', levelSelectVisible);
  await page.click('.level-select-btn[data-level="9"]');
  await page.waitForTimeout(500);

  const bossState = await page.evaluate(() => ({
    currentLevel,
    isBossLevel: !!(levels[currentLevel].isBoss || levels[currentLevel].isMinionBoss || levels[currentLevel].isIceBoss || levels[currentLevel].isFactoryBoss),
    heartsBoxHidden: document.getElementById('hearts-box').classList.contains('hidden'),
    bossActive,
    playerHP
  }));
  console.log('Level 10 boss state:', bossState);
  await page.screenshot({ path: '_verify_05_level10_boss_hud.png' });

  console.log('Console errors/pageerrors captured:', consoleErrors.length ? consoleErrors : 'none');

  await browser.close();
})();
