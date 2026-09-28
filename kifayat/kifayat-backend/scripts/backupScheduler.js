const cron = require('node-cron');
const { main: performBackup } = require('./backup');
const logger = require('../utils/logger');

// Schedule daily backup at 2:00 AM
const backupTask = cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Starting scheduled daily backup');
    await performBackup();
    logger.info('Scheduled backup completed successfully');
  } catch (error) {
    logger.error('Scheduled backup failed', { error: error.message });
  }
}, {
  scheduled: false,
  timezone: 'Asia/Karachi' // Pakistan timezone
});

// Start the scheduler
const startScheduler = () => {
  logger.info('Starting backup scheduler');
  backupTask.start();
  logger.info('Backup scheduler started - Daily backup scheduled for 2:00 AM (Asia/Karachi)');
};

// Stop the scheduler
const stopScheduler = () => {
  logger.info('Stopping backup scheduler');
  backupTask.stop();
  logger.info('Backup scheduler stopped');
};

// Manual trigger for testing
const triggerBackup = async () => {
  try {
    logger.info('Manually triggering backup');
    await performBackup();
    logger.info('Manual backup completed successfully');
  } catch (error) {
    logger.error('Manual backup failed', { error: error.message });
    throw error;
  }
};

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      startScheduler();
      console.log('Backup scheduler started. Press Ctrl+C to stop.');
      // Keep process running
      break;

    case 'stop':
      stopScheduler();
      console.log('Backup scheduler stopped.');
      process.exit(0);
      break;

    case 'trigger':
      triggerBackup()
        .then(() => {
          console.log('Manual backup completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('Manual backup failed:', error.message);
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  node scripts/backupScheduler.js start   - Start scheduler');
      console.log('  node scripts/backupScheduler.js stop    - Stop scheduler');
      console.log('  node scripts/backupScheduler.js trigger - Trigger manual backup');
      process.exit(1);
  }
}

module.exports = {
  startScheduler,
  stopScheduler,
  triggerBackup
};