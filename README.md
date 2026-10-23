# upordown

const Discord = require('discord.js');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const client = new Discord.Client({
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.MESSAGE_CONTENT
    ]
});

const TIME_ZONE = 'Asia/Gaza';
const PREFIX = '+';
const COMMAND = 'جدول';

const MONGODB_URI = process.env.MONGODB_URI;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const mongoClient = new MongoClient(MONGODB_URI || '');

let settingsCollection;
let saved = {};
let updating = false;

// التعيين الافتراضي، إذا لم يوجد سجل سابق في MongoDB
// الجمعة 23/10/2026: نوم خارج البيت
let sleepSettings = {
    anchorDate: '2026-10-23',
    anchorType: 'outside'
};

// قراءة بيانات الرسالة القديمة لترحيلها إلى MongoDB
const OLD_DATA_FILE = path.join(__dirname, 'schedule-message.json');

function readOldData() {
    try {
        if (fs.existsSync(OLD_DATA_FILE)) {
            return JSON.parse(fs.readFileSync(OLD_DATA_FILE, 'utf8'));
        }
    } catch (error) {
        console.error('تعذرت قراءة بيانات الجدول القديم:', error.message);
    }

    return {};
}

// الاتصال بقاعدة البيانات
async function connectDatabase() {
    if (!MONGODB_URI) {
        throw new Error('يرجى ضبط متغير البيئة MONGODB_URI');
    }

    await mongoClient.connect();

    const db = mongoClient.db('sleep_schedule');
    settingsCollection = db.collection('settings');

    // تحميل إعدادات النوم
    const existingSettings = await settingsCollection.findOne({
        _id: 'sleep'
    });

    if (existingSettings) {
        sleepSettings = {
            anchorDate: existingSettings.anchorDate,
            anchorType: existingSettings.anchorType
        };
    } else {
        await settingsCollection.insertOne({
            _id: 'sleep',
            ...sleepSettings
        });
    }

    // تحميل بيانات رسالة الجدول
    const existingSchedule = await settingsCollection.findOne({
        _id: 'schedule_message'
    });

    if (existingSchedule) {
        saved = {
            channelId: existingSchedule.channelId,
            messageId: existingSchedule.messageId,
            weekStart: existingSchedule.weekStart,
            lastDate: existingSchedule.lastDate
        };
    } else {
        // ترحيل بيانات الرسالة من ملف JSON القديم إن وجد
        const oldData = readOldData();

        if (oldData.channelId && oldData.messageId) {
            saved = oldData;

            await settingsCollection.insertOne({
                _id: 'schedule_message',
                ...saved
            });
        }
    }

    console.log('تم الاتصال بـ MongoDB بنجاح');
}

// حفظ بيانات رسالة الجدول
async function saveScheduleData() {
    await settingsCollection.updateOne(
        { _id: 'schedule_message' },
        {
            $set: {
                channelId: saved.channelId || null,
                messageId: saved.messageId || null,
                weekStart: saved.weekStart || null,
                lastDate: saved.lastDate || null
            }
        },
        { upsert: true }
    );
}

// حفظ تاريخ التعيين
async function saveSleepSettings() {
    await settingsCollection.updateOne(
        { _id: 'sleep' },
        {
            $set: {
                anchorDate: sleepSettings.anchorDate,
                anchorType: sleepSettings.anchorType
            }
        },
        { upsert: true }
    );
}

// تاريخ اليوم بتوقيت فلسطين
function getToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const values = {};

    for (const part of parts) {
        values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
}

function toDate(dateString) {
    return new Date(`${dateString}T00:00:00Z`);
}

function addDays(dateString, amount) {
    const date = toDate(dateString);
    date.setUTCDate(date.getUTCDate() + amount);

    return date.toISOString().slice(0, 10);
}

function daysBetween(first, second) {
    return Math.round(
        (toDate(second).getTime() - toDate(first).getTime()) /
        86400000
    );
}

// بداية الأسبوع: السبت
function getWeekStart(dateString) {
    const day = toDate(dateString).getUTCDay();
    const daysSinceSaturday = (day + 1) % 7;

    return addDays(dateString, -daysSinceSaturday);
}

// إذا كان اليوم الجمعة، اعرض الأسبوع الذي يبدأ السبت القادم
function getScheduleStart(today) {
    const day = toDate(today).getUTCDay();

    if (day === 5) {
        return addDays(today, 1);
    }

    return getWeekStart(today);
}

function formatDate(dateString) {
    const date = toDate(dateString);

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

const DAYS = [
    'الأحد',
    'الاثنين',
    'الثلاثاء',
    'الأربعاء',
    'الخميس',
    'الجمعة',
    'السبت'
];

function getDayName(dateString) {
    return DAYS[toDate(dateString).getUTCDay()];
}

// قبول التاريخ بصيغة DD/MM/YYYY
function parseDateInput(input) {
    const match = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
        date.getUTCDate() !== day ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCFullYear() !== year
    ) {
        return null;
    }

    return [
        String(year),
        String(month).padStart(2, '0'),
        String(day).padStart(2, '0')
    ].join('-');
}

// هل النوم خارج البيت في هذا التاريخ؟
// تاريخ التعيين نفسه يأخذ النوع المحدد، وبعده يتناوب كل يوم
function sleepsOutside(dateString) {
    const difference = daysBetween(
        sleepSettings.anchorDate,
        dateString
    );

    const isAnchorOutside = sleepSettings.anchorType === 'outside';
    const isEvenDay = ((difference % 2) + 2) % 2 === 0;

    return isEvenDay ? isAnchorOutside : !isAnchorOutside;
}

// هل يجب إظهار اليوم في الجدول؟
function shouldShowDay(dateString) {
    const dayNumber = toDate(dateString).getUTCDay();

    // السبت والخميس يظهران دائمًا
    const isRequiredDay = dayNumber === 6 || dayNumber === 4;

    // بقية الأيام تظهر فقط إذا كان النوم خارج البيت
    return isRequiredDay || sleepsOutside(dateString);
}

// إنشاء جدول فترة، مقسم إلى إيمبيد لكل أسبوع
function buildPeriodEmbeds(startDate, endDate) {
    const embeds = [];
    let weekStart = getWeekStart(startDate);

    while (weekStart <= endDate) {
        const weekEnd = addDays(weekStart, 6);
        const rows = [];

        // من السبت إلى الجمعة
        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStart, i);

            if (date < startDate || date > endDate) continue;
            if (!shouldShowDay(date)) continue;

            const todayMark = date === getToday()
                ? ' 📍 **اليوم**'
                : '';

            const sleepStatus = sleepsOutside(date)
                ? '🟢 **تحت**'
                : '🔴 **فوق**';

            rows.push(
                `**${todayMark} ${getDayName(date)} | __${formatDate(date)}__** ${sleepStatus}`
            );
        }

        if (rows.length > 0) {
            const embed = new Discord.MessageEmbed()
                .setColor('#3498DB')
                .setTitle('📅 جدول الفترة')
                .setDescription(
                    `**الفترة المطلوبة:** ${formatDate(startDate)} - ${formatDate(endDate)}\n` +
                    `**الأسبوع:** ${formatDate(weekStart)} - ${formatDate(weekEnd)}\n\n` +
                    rows.join('\n\n')
                )
                .setFooter({
                    text: 'جدول الفترة | تم إنشاؤه بواسطة أبو أحمد'
                });

            embeds.push(embed);
        }

        weekStart = addDays(weekStart, 7);
    }

    return embeds;
}

// تفاصيل تاريخ واحد
function buildDateEmbed(dateInput) {
    const dateString = parseDateInput(dateInput);

    if (!dateString) {
        return {
            error:
                '❌ التاريخ غير صحيح.\n' +
                'مثال: `+تاريخ 1/12/2026`'
        };
    }

    const outside = sleepsOutside(dateString);

    const sleepStatus = outside
        ? '🟢 **تحت — نوم خارج البيت**'
        : '🔴 **فوق — نوم في البيت**';

    const embed = new Discord.MessageEmbed()
        .setColor(outside ? '#2ECC71' : '#3498DB')
        .setTitle('📅 تفاصيل اليوم')
        .setDescription(
            `**اليوم:** ${getDayName(dateString)}\n` +
            `**التاريخ:** ${formatDate(dateString)}\n\n` +
            sleepStatus
        )
        .setTimestamp(new Date());

    return { embed };
}

// إنشاء الجدول الأسبوعي
function buildEmbed() {
    const today = getToday();
    const weekStart = getScheduleStart(today);
    const weekEnd = addDays(weekStart, 6);
    const days = [];

    // ترتيب البيانات يبدأ بالسبت
    for (let i = 0; i <= 6; i++) {
        const date = addDays(weekStart, i);

        if (!shouldShowDay(date)) continue;

        const todayMark = date === today ? ' 📍 **اليوم**' : '';

        const sleepStatus = sleepsOutside(date)
            ? '🟢 **تحت**'
            : '🔴 **فوق**';

        days.push(
            `**${todayMark} ${getDayName(date)} | __${formatDate(date)}__** ${sleepStatus}`
        );
    }

    const embed = new Discord.MessageEmbed()
        .setColor('#3498DB')
        .setTitle('📅 الــجـدول')
        .setDescription(
            `**الفترة:** ${formatDate(weekStart)} - ${formatDate(weekEnd)}\n\n` +
            (days.length ? days.join('\n\n') : 'لا توجد أيام لعرضها.')
        )
        .setFooter({
            text: 'تم إنشاؤه بواسطة أبو أحمد'
        })
        .setTimestamp(new Date());

    return { embed, weekStart, today };
}

// تحديث رسالة الجدول المحفوظة
async function updateSchedule(force = false) {
    if (updating) return;

    updating = true;

    try {
        if (!saved.channelId || !saved.messageId) return;

        const { embed, weekStart, today } = buildEmbed();

        if (
            !force &&
            saved.weekStart === weekStart &&
            saved.lastDate === today
        ) {
            return;
        }

        const channel = await client.channels.fetch(saved.channelId);

        if (!channel || !channel.isText()) return;

        const message = await channel.messages.fetch(saved.messageId);

        await message.edit({ embeds: [embed] });

        saved.weekStart = weekStart;
        saved.lastDate = today;

        await saveScheduleData();

        console.log(
            `تم تحديث الجدول: ${today} | الأسبوع يبدأ: ${weekStart}`
        );
    } catch (error) {
        console.error('تعذر تحديث الجدول:', error.message);
    } finally {
        updating = false;
    }
}

client.once('ready', async () => {
    console.log(`🟢 تم تسجيل الدخول: ${client.user.tag}`);

    await updateSchedule(true);

    // فحص اليوم والأسبوع كل دقيقة
    setInterval(() => {
        updateSchedule(false);
    }, 60 * 1000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();

    // الأمر +تعيين: التاريخ المحدد سيكون يوم النوم في البيت
    const setCommand = content.match(
        /^\+تعيين\s+(\S+)$/
    );

    if (setCommand) {
        const date = parseDateInput(setCommand[1]);

        if (!date) {
            await message.reply(
                '❌ التاريخ غير صحيح.\n' +
                'اكتب مثلًا: `+تعيين 24/10/2026`'
            );
            return;
        }

        try {
            sleepSettings = {
                anchorDate: date,
                anchorType: 'home'
            };

            await saveSleepSettings();

            // إعادة حساب وتحديث الإيمبيد المحفوظ مباشرة
            await updateSchedule(true);

            await message.reply(
                `✅ تم تعيين **${formatDate(date)}** يوم نوم في البيت.\n` +
                'تم حفظ التعيين في MongoDB، وسيُحسب التناوب من هذا التاريخ.'
            );
        } catch (error) {
            console.error('خطأ في تعيين التاريخ:', error);

            await message.reply(
                '❌ تعذر حفظ التعيين في MongoDB. تحقق من اتصال قاعدة البيانات.'
            );
        }

        return;
    }

    // الأمر +فترة
    const periodCommand = content.match(
        /^\+فترة\s+(\S+)\s+(\S+)$/
    );

    if (periodCommand) {
        const startDate = parseDateInput(periodCommand[1]);
        const endDate = parseDateInput(periodCommand[2]);

        if (!startDate || !endDate) {
            await message.reply(
                '❌ صيغة التاريخ غير صحيحة.\n' +
                'مثال: `+فترة 23/10/2026 1/1/2027`'
            );
            return;
        }

        if (startDate > endDate) {
            await message.reply(
                '❌ تاريخ البداية يجب أن يكون قبل تاريخ النهاية.'
            );
            return;
        }

        const embeds = buildPeriodEmbeds(startDate, endDate);

        if (!embeds.length) {
            await message.reply(
                'لا توجد أيام مطابقة لشروط جدول النوم في هذه الفترة.'
            );
            return;
        }

        try {
            // ديسكورد يسمح بعشرة إيمبدات في الرسالة الواحدة
            for (let i = 0; i < embeds.length; i += 10) {
                await message.channel.send({
                    embeds: embeds.slice(i, i + 10)
                });
            }
        } catch (error) {
            console.error('خطأ في إنشاء جدول الفترة:', error);

            await message.reply('❌ تعذر إرسال جدول الفترة.');
        }

        return;
    }

    // الأمر +تاريخ
    const dateCommand = content.match(
        /^\+تاريخ\s+(\S+)$/
    );

    if (dateCommand) {
        const result = buildDateEmbed(dateCommand[1]);

        if (result.error) {
            await message.reply(result.error);
        } else {
            await message.reply({
                embeds: [result.embed]
            });
        }

        return;
    }

    // الأمر +جدول
    if (content !== `${PREFIX}${COMMAND}`) return;

    const { embed, weekStart, today } = buildEmbed();

    try {
        // تحديث الرسالة السابقة في القناة نفسها
        if (
            saved.channelId === message.channel.id &&
            saved.messageId
        ) {
            try {
                const oldMessage = await message.channel.messages.fetch(
                    saved.messageId
                );

                await oldMessage.edit({ embeds: [embed] });

                saved.weekStart = weekStart;
                saved.lastDate = today;

                await saveScheduleData();

                await message.reply('✅ تم تحديث الجدول.');
                return;
            } catch (error) {
                // إنشاء رسالة جديدة إذا تعذر العثور على القديمة
                saved.messageId = null;
            }
        }

        const newMessage = await message.channel.send({
            embeds: [embed]
        });

        saved.channelId = message.channel.id;
        saved.messageId = newMessage.id;
        saved.weekStart = weekStart;
        saved.lastDate = today;

        await saveScheduleData();

        await message.reply('✅ تم إنشاء الجدول وحفظ بياناته.');

    } catch (error) {
        console.error('خطأ في إنشاء الجدول:', error);

        await message.reply('❌ حدث خطأ أثناء إنشاء الجدول.');
    }
});

// تشغيل قاعدة البيانات أولًا، ثم البوت
async function startBot() {
    try {
        if (!DISCORD_TOKEN) {
            throw new Error('يرجى ضبط متغير البيئة DISCORD_TOKEN');
        }

        await connectDatabase();
        await client.login(DISCORD_TOKEN);
    } catch (error) {
        console.error('تعذر تشغيل البوت:', error);
        process.exitCode = 1;
    }
}

startBot();
