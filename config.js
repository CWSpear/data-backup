const config = {
    projectId: 'cameron-spear',
    backupBucket: 'cameronspear-website-data-backup',
    backupDir: '/data/',

    timezone: 'America/Los_Angeles',

    cleaningStrategy: 'keep-last',
    keepLast: 20,
    backupFrequency: 'hourly',
    // plans: [
    //     {
    //         frequency: 'hourly',
    //         keep: { days: 1 },
    //     },
    //     {
    //         frequency: 'daily',
    //         keep: { weeks: 1, days: 1 },
    //     },
    //     {
    //         frequency: 'weekly',
    //         keep: { months: 2, weeks: 1 },
    //     },
    //     {
    //         frequency: 'monthly',
    //         keep: 'forever',
    //     },
    // ],
};

module.exports = config;
