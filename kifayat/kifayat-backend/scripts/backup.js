const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const logger = require('../utils/logger');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const BACKUP_DIR = path.join(__dirname, '../backups');
const RETENTION_DAYS = 30; // Keep backups for 30 days

// Create backup directory if it doesn't exist
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  logger.info('Created backup directory', { BACKUP_DIR });
}

// Generate backup filename with timestamp
const generateBackupFilename = () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').split('T')[0];
  return `kifayat-backup-${timestamp}.gz`;
};

// Extract database name from connection string
const getDatabaseName = (uri) => {
  try {
    const match = uri.match(/\/([^/?]+)(\?|$)/);
    return match ? match[1] : 'kifayat';
  } catch (error) {
    logger.error('Failed to extract database name from URI', { error: error.message });
    return 'kifayat';
  }
};

// Perform MongoDB backup using mongodump
const performBackup = async () => {
  const timestamp = new Date().toISOString();
  const backupFile = path.join(BACKUP_DIR, generateBackupFilename());
  const dbName = getDatabaseName(MONGODB_URI);

  logger.info('Starting MongoDB backup', { timestamp, dbName, backupFile });

  // Check if mongodump is available
  return new Promise((resolve, reject) => {
    exec('mongodump --version', (error, stdout, stderr) => {
      if (error) {
        logger.error('mongodump not found - backup cannot proceed', { 
          error: 'mongodump CLI tool not installed or not in PATH',
          suggestion: 'Install MongoDB Tools or use MongoDB Atlas backup API'
        });
        reject(new Error('mongodump not available'));
        return;
      }

      // mongodump is available, proceed with backup
      const command = `mongodump --uri="${MONGODB_URI}" --gzip --archive="${backupFile}"`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('MongoDB backup failed', { 
            error: error.message, 
            stderr,
            backupFile 
          });
          reject(error);
          return;
        }

        const fileSize = fs.statSync(backupFile).size;
        logger.info('MongoDB backup completed successfully', { 
          backupFile, 
          fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
          timestamp 
        });

        resolve({ backupFile, fileSize, timestamp });
      });
    });
  });
};

// Clean old backups
const cleanOldBackups = async () => {
  logger.info('Cleaning old backups', { RETENTION_DAYS });

  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const retentionMs = RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let deletedCount = 0;
    let totalFreedSpace = 0;

    for (const file of files) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > retentionMs) {
        const fileSize = stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
        totalFreedSpace += fileSize;
        
        logger.info('Deleted old backup', { 
          file, 
          ageDays: Math.floor(fileAge / (24 * 60 * 60 * 1000)),
          fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`
        });
      }
    }

    logger.info('Backup cleanup completed', { 
      deletedCount, 
      freedSpace: `${(totalFreedSpace / 1024 / 1024).toFixed(2)} MB` 
    });

    return { deletedCount, freedSpace: totalFreedSpace };
  } catch (error) {
    logger.error('Backup cleanup failed', { error: error.message });
    throw error;
  }
};

// Verify backup integrity
const verifyBackup = async (backupFile) => {
  logger.info('Verifying backup integrity', { backupFile });

  try {
    const stats = fs.statSync(backupFile);
    const fileSize = stats.size;

    if (fileSize === 0) {
      throw new Error('Backup file is empty');
    }

    // Additional verification could be added here
    // For now, we check if the file is a valid gzip file
    const buffer = fs.readFileSync(backupFile);
    if (buffer[0] !== 0x1f || buffer[1] !== 0x8b) {
      throw new Error('Backup file is not a valid gzip archive');
    }

    logger.info('Backup verification passed', { 
      backupFile, 
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB` 
    });

    return { valid: true, fileSize };
  } catch (error) {
    logger.error('Backup verification failed', { 
      backupFile, 
      error: error.message 
    });
    return { valid: false, error: error.message };
  }
};

// List all backups
const listBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const backups = files.map(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        size: stats.size,
        created: stats.mtime,
        sizeFormatted: `${(stats.size / 1024 / 1024).toFixed(2)} MB`
      };
    }).sort((a, b) => b.created - a.created);

    return backups;
  } catch (error) {
    logger.error('Failed to list backups', { error: error.message });
    return [];
  }
};

// Restore from backup
const restoreBackup = async (backupFile) => {
  const backupPath = path.join(BACKUP_DIR, backupFile);

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupFile}`);
  }

  logger.info('Starting MongoDB restore', { backupFile });

  return new Promise((resolve, reject) => {
    const command = `mongorestore --uri="${MONGODB_URI}" --gzip --archive="${backupPath}" --drop`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error('MongoDB restore failed', { 
          error: error.message, 
          stderr,
          backupFile 
        });
        reject(error);
        return;
      }

      logger.info('MongoDB restore completed successfully', { backupFile });
      resolve({ backupFile, timestamp: new Date().toISOString() });
    });
  });
};

// Main backup function
const main = async () => {
  try {
    logger.info('Starting backup process');

    // Clean old backups first
    await cleanOldBackups();

    // Perform new backup
    const backupResult = await performBackup();

    // Verify backup
    const verification = await verifyBackup(backupResult.backupFile);

    if (!verification.valid) {
      logger.error('Backup verification failed, deleting corrupted backup');
      fs.unlinkSync(backupResult.backupFile);
      throw new Error('Backup verification failed');
    }

    // List all backups
    const allBackups = listBackups();

    logger.info('Backup process completed successfully', {
      latestBackup: backupResult.backupFile,
      totalBackups: allBackups.length,
      totalSize: `${allBackups.reduce((sum, b) => sum + b.size, 0) / 1024 / 1024} MB`
    });

    return {
      success: true,
      backup: backupResult,
      verification,
      allBackups
    };

  } catch (error) {
    logger.error('Backup process failed', { error: error.message });
    throw error;
  }
};

// CLI interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'backup':
      main()
        .then(() => {
          logger.info('Backup completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Backup failed', { error: error.message });
          process.exit(1);
        });
      break;

    case 'restore':
      const backupFile = process.argv[3];
      if (!backupFile) {
        console.error('Please specify backup file to restore');
        process.exit(1);
      }
      restoreBackup(backupFile)
        .then(() => {
          logger.info('Restore completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Restore failed', { error: error.message });
          process.exit(1);
        });
      break;

    case 'list':
      const backups = listBackups();
      console.log('Available backups:');
      backups.forEach(backup => {
        console.log(`- ${backup.filename} (${backup.sizeFormatted}, ${backup.created.toISOString()})`);
      });
      process.exit(0);
      break;

    case 'cleanup':
      cleanOldBackups()
        .then(() => {
          logger.info('Cleanup completed successfully');
          process.exit(0);
        })
        .catch((error) => {
          logger.error('Cleanup failed', { error: error.message });
          process.exit(1);
        });
      break;

    default:
      console.log('Usage:');
      console.log('  node scripts/backup.js backup    - Perform backup');
      console.log('  node scripts/backup.js restore <file> - Restore from backup');
      console.log('  node scripts/backup.js list      - List all backups');
      console.log('  node scripts/backup.js cleanup   - Clean old backups');
      process.exit(1);
  }
}

module.exports = {
  performBackup,
  cleanOldBackups,
  verifyBackup,
  listBackups,
  restoreBackup,
  main
};