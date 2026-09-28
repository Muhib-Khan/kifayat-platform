# Disaster Recovery Plan

## Overview
This document outlines the disaster recovery procedures for the Kifayat e-commerce platform. It covers backup strategies, recovery procedures, and emergency response plans for various failure scenarios.

## Table of Contents
1. [Backup Strategy](#backup-strategy)
2. [Recovery Procedures](#recovery-procedures)
3. [Emergency Response](#emergency-response)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Testing and Validation](#testing-and-validation)

---

## Backup Strategy

### Database Backups
- **Frequency**: Daily automated backups at 2:00 AM (Asia/Karachi timezone)
- **Retention**: 30 days
- **Location**: Local storage in `kifayat-backend/backups/`
- **Format**: MongoDB Archive (gzip compressed)
- **Verification**: Automatic integrity verification after each backup

### Backup Commands
```bash
# Manual backup
npm run backup

# List all backups
npm run backup:list

# Clean old backups (older than 30 days)
npm run backup:cleanup

# Restore from specific backup
npm run backup:restore <backup-file>
```

### Backup Contents
- All MongoDB collections (users, products, orders, etc.)
- Indexes and database structure
- Document relationships and references

### What is NOT backed up
- Uploaded files (handled separately via Cloudinary)
- Firebase service account (should be stored securely)
- Environment variables (should be stored securely)

---

## Recovery Procedures

### Database Recovery

#### 1. Restore from Backup
```bash
# List available backups
npm run backup:list

# Restore from specific backup
npm run backup:restore kifayat-backup-2026-08-31.gz
```

#### 2. MongoDB Atlas Point-in-Time Recovery
If using MongoDB Atlas, you can also use their built-in point-in-time recovery:
- Navigate to your cluster in Atlas
- Go to "Backup" tab
- Select "Restore" and choose the point in time
- Follow the Atlas restore wizard

#### 3. Emergency Recovery Steps
1. **Stop application**: `npm stop` or kill the process
2. **Assess damage**: Check logs in `kifayat-backend/logs/`
3. **Choose backup**: Select the most recent valid backup
4. **Restore database**: Use backup restore command
5. **Verify data**: Check critical data (users, orders, products)
6. **Restart application**: `npm start`
7. **Monitor health**: Check `/api/health` endpoint

### Application Recovery

#### 1. Code Rollback
```bash
# View recent commits
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash>

# Push to production (careful!)
git push origin main --force
```

#### 2. Environment Recovery
- Ensure all environment variables are set correctly
- Verify MongoDB connection string
- Check Firebase service account configuration
- Validate email provider settings

---

## Emergency Response

### Severity Levels

#### P0 - Critical (Immediate Response Required)
- Complete system outage
- Data loss or corruption
- Security breach
- Payment processing failure

**Response Time**: < 15 minutes
**Escalation**: Immediate notification to all stakeholders

#### P1 - High (Response within 1 hour)
- Major feature broken
- Performance degradation affecting users
- Partial data loss
- API failures

**Response Time**: < 1 hour
**Escalation**: Notify technical team within 30 minutes

#### P2 - Medium (Response within 4 hours)
- Minor feature issues
- Performance issues not affecting critical paths
- Non-critical bugs

**Response Time**: < 4 hours
**Escalation**: Notify during next team standup

#### P3 - Low (Response within 24 hours)
- Cosmetic issues
- Documentation updates
- Minor optimizations

**Response Time**: < 24 hours
**Escalation**: Regular backlog review

### Emergency Contacts
- **Technical Lead**: [Contact info]
- **Database Administrator**: [Contact info]
- **DevOps Engineer**: [Contact info]
- **Product Owner**: [Contact info]

### Communication Plan
1. **Internal**: Use Slack/Discord for immediate communication
2. **External**: Prepare status page updates for users
3. **Stakeholders**: Email updates for critical incidents

---

## Monitoring and Alerting

### Health Check Endpoints
- **General Health**: `GET /api/health`
- **Firebase Status**: `GET /api/health/firebase`
- **Backup Status**: `GET /api/health/backups`

### Key Metrics to Monitor
- Database connection status
- System uptime
- Memory usage
- Disk space (for backups)
- API response times
- Error rates

### Log Locations
- **Application logs**: `kifayat-backend/logs/combined-YYYY-MM-DD.log`
- **Error logs**: `kifayat-backend/logs/error-YYYY-MM-DD.log`
- **Access logs**: `kifayat-backend/logs/access-YYYY-MM-DD.log`
- **Exception logs**: `kifayat-backend/logs/exceptions-YYYY-MM-DD.log`

### Alerting Setup
Consider setting up alerts for:
- Database connection failures
- High error rates (> 5%)
- High memory usage (> 80%)
- Backup failures
- Disk space running low (< 20% free)

---

## Testing and Validation

### Backup Testing
- **Frequency**: Weekly backup restoration tests
- **Procedure**: 
  1. Take a fresh backup
  2. Restore to test environment
  3. Verify data integrity
  4. Test critical application functions
  5. Document results

### Recovery Drills
- **Frequency**: Monthly disaster recovery drills
- **Scenarios**:
  1. Database corruption recovery
  2. Application server failure
  3. Partial data loss
  4. Security incident response

### Validation Checklist
After any recovery procedure, verify:
- [ ] Database connection established
- [ ] User authentication working
- [ ] Product catalog accessible
- [ ] Order processing functional
- [ ] Email notifications sending
- [ ] Admin panel accessible
- [ ] Real-time features (Socket.IO) working
- [ ] Performance metrics normal

---

## Specific Scenarios

### Scenario 1: Database Corruption
1. **Identify**: Check logs for database errors
2. **Stop**: Stop application to prevent further damage
3. **Assess**: Determine extent of corruption
4. **Restore**: Use most recent clean backup
5. **Verify**: Run data integrity checks
6. **Monitor**: Watch for recurring issues

### Scenario 2: Application Server Failure
1. **Identify**: Server not responding or crashing
2. **Restart**: Attempt application restart
3. **Logs**: Check application logs for errors
4. **Rollback**: If recent deployment, consider rollback
5. **Scale**: If resource issue, consider scaling up
6. **Monitor**: Watch system metrics

### Scenario 3: Security Incident
1. **Identify**: Unusual activity, unauthorized access
2. **Contain**: Isolate affected systems
3. **Investigate**: Analyze logs and access patterns
4. **Remediate**: Patch vulnerabilities, reset credentials
5. **Notify**: Inform stakeholders and users if needed
6. **Review**: Update security procedures

### Scenario 4: Data Loss
1. **Identify**: Missing or corrupted data
2. **Assess**: Determine scope and impact
3. **Restore**: Use appropriate backup
4. **Reconcile**: Compare with expected state
5. **Communicate**: Inform affected users if necessary
6. **Prevent**: Review and improve data protection

---

## Maintenance

### Regular Tasks
- **Daily**: Monitor backup completion
- **Weekly**: Review log files for issues
- **Monthly**: Test backup restoration
- **Quarterly**: Review and update disaster recovery plan
- **Annually**: Full disaster recovery drill

### Documentation Updates
Keep this document updated with:
- New backup procedures
- Changed contact information
- Lessons learned from incidents
- Updated technology stack
- New monitoring tools

---

## Appendix

### Useful Commands
```bash
# Check application health
curl http://localhost:3001/api/health

# Check backup status
curl http://localhost:3001/api/health/backups

# View recent logs
tail -f kifayat-backend/logs/combined-$(date +%Y-%m-%d).log

# Check MongoDB connection
mongo "mongodb+srv://<user>:<password>@<cluster>/test?replicaSet=rs0"

# Database stats
mongo "mongodb+srv://<user>:<password>@<cluster>/test" --eval "db.stats()"
```

### External Services
- **MongoDB Atlas**: https://cloud.mongodb.com/
- **Firebase Console**: https://console.firebase.google.com/
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Northflank**: https://northflank.com/

### Support Resources
- MongoDB Documentation: https://docs.mongodb.com/
- Node.js Documentation: https://nodejs.org/docs/
- Express.js Documentation: https://expressjs.com/

---

**Last Updated**: 2026-08-31
**Version**: 1.0
**Maintained By**: Development Team