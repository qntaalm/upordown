const express = require("express")
const app = express();
var listener = app.listen(process.env.PORT || 2000, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
app.listen(() => console.log("I'm Ready To Work..! 24H"));
app.get('/', (req, res) => {
  res.send(`
  <body>
  <center><h1>Bot 24H ON!</h1></center
  </body>`)
});
//====================================  
const Discord = require('discord.js');
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

// الجمعة 23/10/2026: خارج البيت
const ANCHOR_DATE = '2026-10-23';

const DATA_FILE = path.join(__dirname, 'schedule-message.json');

let saved = {};
let updating = false;

if (fs.existsSync(DATA_FILE)) {
    try {
        saved = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (error) {
        console.error('خطأ في قراءة بيانات الجدول:', error);
    }
}

function saveData() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(saved, null, 2));
}

// حالة البوت
client.once('ready', () => {
    console.clear();
    console.log(`${client.user.tag} is Online 🟢`);

    client.user.setStatus('idle');

    const status = [
        `${client.user.username}`,
        'My Dev M7md6565',
        `My Prefix ${PREFIX} | Mention Me`
    ];

    client.user.setActivity(
        status[Math.floor(Math.random() * status.length)]
    );

    setInterval(() => {
        client.user.setActivity(
            status[Math.floor(Math.random() * status.length)]
        );
    }, 8000);
});

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

// إذا كان اليوم الجمعة، يبدأ الجدول من السبت القادم
function getScheduleStart(today) {
    const day = toDate(today).getUTCDay();

    if (day === 5) {
        return addDays(today, 1);
    }

    return getWeekStart(today);
}

// تنسيق التاريخ
function formatDate(dateString) {
    const date = toDate(dateString);

    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();

    return `${day}/${month}/${year}`;
}

// أسماء الأيام
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

// النوم خارج البيت يومًا بعد يوم
function sleepsOutside(dateString) {
    const difference = daysBetween(ANCHOR_DATE, dateString);

    return ((difference % 2) + 2) % 2 === 0;
}

// تحويل التاريخ من DD/MM/YYYY إلى YYYY-MM-DD
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

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// إنشاء إيمبد الجدول الرئيسي
function buildEmbed() {
    const today = getToday();
    const weekStart = getScheduleStart(today);
    const weekEnd = addDays(weekStart, 6);

    const days = [];

    // ترتيب الأيام من السبت إلى الجمعة
    for (let i = 0; i < 7; i++) {
        const date = addDays(weekStart, i);
        const dayNumber = toDate(date).getUTCDay();

        const outside = sleepsOutside(date);

        // السبت والخميس يظهران دائمًا
        const isRequiredDay =
            dayNumber === 6 || dayNumber === 4;

        // إظهار أيام الخارج، والسبت والخميس،
        // واليوم الحالي حتى لو كان النوم في البيت
        if (!isRequiredDay && !outside && date !== today) {
            continue;
        }

        const todayMark = date === today ? '📍 ' : '';

        const dayEmoji =
            dayNumber === 6 || dayNumber === 4
                ? '⬅️ '
                : '';

        const sleepStatus = outside
            ? '🟢 **تحت**'
            : '🔴 فوق';

        days.push(
            `**${todayMark}| ${dayEmoji}${getDayName(date)} | __${formatDate(date)}__** ${sleepStatus}`
        );
    }

    const embed = new Discord.MessageEmbed()
        .setColor('#3498DB')
        .setTitle(
            `📅 الــجـدول | ${getDayName(today)} ${formatDate(today)}`
        )
        .setDescription(
            `الـفـتـرة: **${formatDate(weekStart)} - ${formatDate(weekEnd)}**\n\n` +
            days.join('\n\n')
        )
        .setFooter({
            text: 'تم إنشاؤه بواسطة أبو أحمد'
        })
        .setTimestamp(new Date());

    return { embed, weekStart, today };
}

// تحديث رسالة الجدول المحفوظة تلقائيًا
async function updateSchedule(force = false) {
    if (updating) return;

    updating = true;

    try {
        if (!saved.channelId || !saved.messageId) {
            return;
        }

        const { embed, weekStart, today } = buildEmbed();

        // لا نعدّل الرسالة إذا لم يتغير اليوم أو الأسبوع
        if (
            !force &&
            saved.weekStart === weekStart &&
            saved.lastDate === today
        ) {
            return;
        }

        const channel = await client.channels.fetch(saved.channelId);

        if (!channel || !channel.isText()) {
            console.error('القناة غير موجودة أو ليست قناة نصية.');
            return;
        }

        const message = await channel.messages.fetch(saved.messageId);

        // تعديل نفس الإيمبد، وليس إرسال رسالة جديدة
        await message.edit({ embeds: [embed] });

        saved.weekStart = weekStart;
        saved.lastDate = today;

        saveData();

        console.log(
            `✅ تم تحديث الجدول | ${today} | بداية الأسبوع: ${weekStart}`
        );
    } catch (error) {
        console.error('❌ تعذر تحديث الجدول:', error.message);
    } finally {
        updating = false;
    }
}

// تشغيل التحديث التلقائي
client.once('ready', async () => {
    // تحديث الجدول عند تشغيل البوت
    await updateSchedule(true);

    // فحص التاريخ كل دقيقة
    setInterval(() => {
        updateSchedule(false);
    }, 60 * 1000);
});

// إنشاء جدول لفترة زمنية
function buildPeriodEmbeds(startDate, endDate) {
    const embeds = [];

    let weekStart = getWeekStart(startDate);

    while (weekStart <= endDate) {
        const weekEnd = addDays(weekStart, 6);
        const rows = [];

        for (let i = 0; i < 7; i++) {
            const date = addDays(weekStart, i);

            if (date < startDate || date > endDate) {
                continue;
            }

            const dayNumber = toDate(date).getUTCDay();
            const outside = sleepsOutside(date);

            const isRequiredDay =
                dayNumber === 6 || dayNumber === 4;

            const today = getToday();

            if (
                !isRequiredDay &&
                !outside &&
                date !== today
            ) {
                continue;
            }

            const todayMark =
                date === today ? '📍 ' : '';

            const sleepStatus = outside
                ? '🟢 **تحت**'
                : '🔴 فوق';

            rows.push(
                `**${todayMark}${getDayName(date)} | __${formatDate(date)}__** ${sleepStatus}`
            );
        }

        if (rows.length > 0) {
            const periodEmbed = new Discord.MessageEmbed()
                .setColor('#3498DB')
                .setTitle('📅 جدول الفترة')
                .setDescription(
                    `الأسبوع: **${formatDate(weekStart)} - ${formatDate(weekEnd)}**\n\n` +
                    rows.join('\n\n')
                )
                .setFooter({
                    text: 'جدول الفترة | تم إنشاؤه بواسطة أبو أحمد'
                });

            embeds.push(periodEmbed);
        }

        weekStart = addDays(weekStart, 7);
    }

    return embeds;
}

// تفاصيل يوم معين
function buildDateEmbed(dateInput) {
    const dateString = parseDateInput(dateInput);

    if (!dateString) {
        return {
            error:
                '❌ التاريخ غير صحيح.\n' +
                'اكتب التاريخ هكذا: `+تاريخ 1/12/2026`'
        };
    }

    const outside = sleepsOutside(dateString);

    const sleepStatus = outside
        ? '🟢 **تحت**'
        : '🔴 فوق';

    const embed = new Discord.MessageEmbed()
        .setColor(outside ? '#2ECC71' : '#3498DB')
        .setTitle('📅 تفاصيل')
        .setDescription(
            `**اليوم:** ${getDayName(dateString)}\n` +
            `**التاريخ:** ${formatDate(dateString)}\n\n` +
            sleepStatus
        )
        .setTimestamp(new Date());

    return { embed };
}

// استقبال الأوامر
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    const content = message.content.trim();

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

        if (embeds.length === 0) {
            await message.reply(
                'لا توجد أيام مطابقة لشروط جدول النوم في هذه الفترة.'
            );
            return;
        }

        try {
            // الحد الأقصى 10 إيمبدات لكل رسالة
            for (let i = 0; i < embeds.length; i += 10) {
                await message.channel.send({
                    embeds: embeds.slice(i, i + 10)
                });
            }
        } catch (error) {
            console.error('خطأ في إنشاء جدول الفترة:', error);

            await message.reply(
                '❌ تعذر إرسال جدول الفترة.'
            );
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
    if (content !== `${PREFIX}${COMMAND}`) {
        return;
    }

    const { embed, weekStart, today } = buildEmbed();

    try {
        // تحديث الجدول السابق إذا كان في القناة نفسها
        if (
            saved.channelId === message.channel.id &&
            saved.messageId
        ) {
            try {
                const oldMessage = await message.channel.messages.fetch(
                    saved.messageId
                );

                await oldMessage.edit({
                    embeds: [embed]
                });

                saved.weekStart = weekStart;
                saved.lastDate = today;

                saveData();

                await message.reply('✅ تم تحديث الجدول.');
                return;
            } catch (error) {
                saved.messageId = null;
            }
        }

        // إنشاء جدول جديد إذا لم توجد رسالة محفوظة
        const newMessage = await message.channel.send({
            embeds: [embed]
        });

        saved.channelId = message.channel.id;
        saved.messageId = newMessage.id;
        saved.weekStart = weekStart;
        saved.lastDate = today;

        saveData();

        await message.reply('✅ تم إنشاء الجدول.');
    } catch (error) {
        console.error('خطأ في إنشاء الجدول:', error);

        await message.reply(
            '❌ حدث خطأ أثناء إنشاء الجدول.'
        );
    }
});
client.login(process.env.token);
