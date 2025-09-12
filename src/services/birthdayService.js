const User = require('../models/User');
const socketService = require('./socketService');

class BirthdayService {
    constructor() {
        this.isRunning = false;
    }

    start() {
        if (this.isRunning) {
            console.log('🎂 Birthday service already running');
            return;
        }

        this.isRunning = true;
        console.log('🎂 Birthday notification service started');

        this.checkBirthdays();

        this.intervalId = setInterval(() => {
            this.checkBirthdays();
        }, 60 * 60 * 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('🎂 Birthday notification service stopped');
    }

    async checkBirthdays() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayMonth = today.getMonth();
            const todayDate = today.getDate();

            console.log(`🎂 Checking for birthdays on ${today.toDateString()}`);

            const birthdayUsers = await User.find({
                birthdate: {
                    $ne: null
                },
                ban_status: false,
                $expr: {
                    $and: [
                        { $eq: [{ $month: '$birthdate' }, todayMonth + 1] }, { $eq: [{ $dayOfMonth: '$birthdate' }, todayDate] }
                    ]
                },
                $or: [
                    { last_birthday_notification: { $eq: null } },
                    { last_birthday_notification: { $lt: today } }
                ]
            });

            if (birthdayUsers.length === 0) {
                console.log('🎂 No birthdays found for today');
                return;
            }

            console.log(`🎂 Found ${birthdayUsers.length} birthday(s) today!`);

            for (const user of birthdayUsers) {
                try {
                    const birthdayBadge = user.birthday_badge;

                    if (birthdayBadge.is_birthday) {

                        await socketService.sendBirthdayNotification(
                            user._id,
                            null, {
                            user_name: user.name,
                            user_username: user.username,
                            age: birthdayBadge.age
                        }
                        );

                        await User.findByIdAndUpdate(user._id, {
                            last_birthday_notification: today
                        });

                        console.log(`🎂 Sent birthday notifications for ${user.name} (@${user.username}) - Age ${birthdayBadge.age}`);
                    }
                } catch (userError) {
                    console.error(`🎂 Error processing birthday for user ${user.username}:`, userError);
                }
            }

            console.log(`🎂 Birthday notification process completed for ${birthdayUsers.length} users`);

        } catch (error) {
            console.error('🎂 Birthday check error:', error);
        }
    }

    async triggerBirthdayCheck() {
        console.log('🎂 Manually triggering birthday check...');
        await this.checkBirthdays();
    }

    async getBirthdayStats() {
        try {
            const today = new Date();
            const todayMonth = today.getMonth();
            const todayDate = today.getDate();

            const [todayCount, thisWeekCount, thisMonthCount, totalWithBirthdays] = await Promise.all([

                User.countDocuments({
                    birthdate: { $ne: null },
                    ban_status: false,
                    $expr: {
                        $and: [
                            { $eq: [{ $month: '$birthdate' }, todayMonth + 1] },
                            { $eq: [{ $dayOfMonth: '$birthdate' }, todayDate] }
                        ]
                    }
                }),

                User.countDocuments({
                    birthdate: { $ne: null },
                    ban_status: false,
                    $expr: {
                        $let: {
                            vars: {
                                birthMonth: { $month: '$birthdate' },
                                birthDay: { $dayOfMonth: '$birthdate' },
                                todayMonth: todayMonth + 1,
                                todayDay: todayDate
                            },
                            in: {
                                $or: [

                                    {
                                        $and: [
                                            { $eq: ['$$birthMonth', '$$todayMonth'] },
                                            { $gte: ['$$birthDay', '$$todayDay'] },
                                            { $lte: ['$$birthDay', { $add: ['$$todayDay', 7] }] }
                                        ]
                                    },
                                    {
                                        $and: [
                                            { $eq: ['$$birthMonth', { $add: ['$$todayMonth', 1] }] },
                                            { $lte: ['$$birthDay', { $add: ['$$todayDay', 7] }] },
                                            { $gt: [{ $add: ['$$todayDay', 7] }, 31] }]
                                    }
                                ]
                            }
                        }
                    }
                }),

                User.countDocuments({
                    birthdate: { $ne: null },
                    ban_status: false,
                    $expr: {
                        $eq: [{ $month: '$birthdate' }, todayMonth + 1]
                    }
                }),

                User.countDocuments({
                    birthdate: { $ne: null },
                    ban_status: false
                })
            ]);

            return {
                today: todayCount,
                this_week: thisWeekCount,
                this_month: thisMonthCount,
                total_with_birthdays: totalWithBirthdays,
                service_running: this.isRunning,
                last_check: new Date().toISOString()
            };
        } catch (error) {
            console.error('Get birthday stats error:', error);
            return null;
        }
    }
}

module.exports = new BirthdayService();