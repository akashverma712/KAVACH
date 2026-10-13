import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { pool, query } from './pool.js';
import { normalizePhone } from '../utils/phone.js';
import { seedCommunity } from './seedCommunity.js';
import { seedFundraisers } from './seedFundraisers.js';

const DEMO_ROSTER = [
  { name: 'Aarav Kumar', branch: 'Computer Science & Engineering', batch: '2022-2026', regd_no: '22CSE001', email: 'aarav.22cse001@bitsindri.ac.in', phone: '9000000001' },
  { name: 'Priya Singh', branch: 'Electronics & Communication Engineering', batch: '2023-2027', regd_no: '23ECE014', email: 'priya.23ece014@bitsindri.ac.in', phone: '9000000002' },
  { name: 'Rohit Mahato', branch: 'Mechanical Engineering', batch: '2021-2025', regd_no: '21ME042', email: 'rohit.21me042@bitsindri.ac.in', phone: '9000000003' },
  { name: 'Sneha Oraon', branch: 'Civil Engineering', batch: '2024-2028', regd_no: '24CE007', email: null, phone: '9000000004' },
];

const FAQS = [
  // Using the app
  { category: 'app', question: 'How do I send an SOS alert?', keywords: 'sos emergency alert button help panic danger',
    answer: 'Open the SOS tab and tap the red button, or say "help" when voice trigger is switched on. A 10-second countdown starts so you can cancel an accidental press. When it ends, your live location (a Google Maps link) is sent by SMS to all your emergency contacts and the campus admin.' },
  { category: 'app', question: 'How many SOS alerts can I send?', keywords: 'sos limit hour maximum ten',
    answer: 'You can send up to 10 SOS alerts in any rolling one-hour window. The SOS screen shows how many you have left.' },
  { category: 'app', question: 'How do I add or edit emergency contacts?', keywords: 'emergency contact add edit phone number family friend',
    answer: 'Go to Profile or the SOS tab and use the Emergency contacts section. You can save up to 5 personal contacts. The campus admin number is always included and cannot be removed.' },
  { category: 'app', question: 'Does SOS work without internet?', keywords: 'offline internet no network sms sos',
    answer: 'If you are offline, the SOS screen offers to open your phone\'s SMS app with your location and contacts pre-filled, and it also queues the alert so it is sent automatically when you reconnect.' },
  { category: 'app', question: 'How do I report a problem on campus?', keywords: 'problem complaint issue report post community hostel water electricity',
    answer: 'Open Community and choose "Post a problem". Add a title, description, severity and up to 4 photos. The admin can mark it for solving, in progress, under review or solved, and you will get a notification at every step.' },
  { category: 'app', question: 'How do I close a problem I posted?', keywords: 'close problem resolved solved mark',
    answer: 'You can close your own problem at any time from its page. When the admin marks it solved you will be asked to confirm; once both of you have marked it resolved it closes automatically.' },
  { category: 'app', question: 'How do I start a fundraiser?', keywords: 'fundraiser fund raise money donation medical accident help qr',
    answer: 'Open Fundraisers and choose "Start a fundraiser". Add the story, amount needed, one or more payment QR codes (useful when a UPI limit is reached) and proof such as hospital documents. It becomes visible to other students once the admin approves it.' },
  { category: 'app', question: 'Who can see my phone number and email?', keywords: 'privacy phone email visible data personal',
    answer: 'Your phone number and email are never shown to other students. The community only shows your name, branch and batch. Fundraiser proof documents are visible only to you and the admin.' },
  { category: 'app', question: 'Why can\'t I change my email or phone number?', keywords: 'change email phone update verified',
    answer: 'Your email and phone are verified against college records, so they are locked. Contact the admin if they need to be corrected.' },
  { category: 'app', question: 'I did not receive my OTP', keywords: 'otp code not received sms email verification',
    answer: 'Wait 30 seconds and tap "Resend code", or go back and choose the other option (email or phone) if you added both. Check your spam folder for email. Each code is valid for 5 minutes.' },

  // Safety & wellbeing
  { category: 'safety', question: 'What are the national emergency numbers in India?', keywords: 'emergency number police ambulance fire 112 108 women helpline',
    answer: 'Call 112 for any emergency (police, fire, ambulance). 108 is the ambulance service in most states, 1091 and 181 are women helplines, and 1098 is the child helpline.' },
  { category: 'wellbeing', question: 'I am feeling stressed or low. Where can I get help?', keywords: 'stress anxiety depression mental health counselling sad lonely talk help',
    answer: 'You are not alone. Tele-MANAS, the Government of India\'s free 24×7 mental health helpline, is available at 14416 or 1-800-891-4416. You can also reach out to a trusted faculty member, your hostel warden or a friend. If you are in immediate danger, use SOS or call 112.' },
  { category: 'wellbeing', question: 'How can I manage exam stress?', keywords: 'exam stress study sleep tips pressure',
    answer: 'Break study into 45–50 minute blocks with short breaks, keep a regular sleep schedule, eat proper meals and move a little every day. Talking to seniors and friends helps more than you expect. If stress feels overwhelming, call Tele-MANAS at 14416.' },

  // College
  { category: 'college', question: 'Where is BIT Sindri located?', keywords: 'location address where sindri dhanbad jharkhand campus',
    answer: 'BIT Sindri (Birsa Institute of Technology Sindri) is in Sindri, Dhanbad district, Jharkhand. The official website is bitsindri.ac.in.' },
  { category: 'college', question: 'When was BIT Sindri established?', keywords: 'established founded history year 1949',
    answer: 'BIT Sindri was established in 1949 and is one of the oldest engineering institutes in eastern India.' },
  { category: 'college', question: 'Which university is BIT Sindri affiliated to?', keywords: 'university affiliated jut jharkhand university of technology',
    answer: 'BIT Sindri is affiliated to Jharkhand University of Technology (JUT), Ranchi. Check bitsindri.ac.in for the latest academic notices.' },
  { category: 'college', question: 'How do admissions to B.Tech work?', keywords: 'admission btech jee main jceceb counselling',
    answer: 'B.Tech admissions are made through state counselling conducted by JCECEB on the basis of JEE Main scores. Always confirm dates and eligibility on the official JCECEB and college websites.' },
  { category: 'college', question: 'Where can I find exam schedules and notices?', keywords: 'exam schedule notice timetable result academic calendar',
    answer: 'Official exam schedules, results and notices are published on bitsindri.ac.in and by the university. Your department notice board and class representatives also share updates.' },
  { category: 'college', question: 'Who do I contact for hostel issues?', keywords: 'hostel warden room mess water electricity complaint',
    answer: 'Contact your hostel warden first. For problems that affect many students, post them in Community so the admin can track them to resolution.' },
];

export async function seed({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);

  await query(
    `INSERT INTO admins (name, email, phone) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [env.admin.name, env.admin.email, normalizePhone(env.admin.phone)],
  );

  await query(
    `INSERT INTO settings (key, value) VALUES
       ('admin_emergency_phone', $1),
       ('admin_emergency_name', 'Campus Admin (BIT Sindri)')
     ON CONFLICT (key) DO NOTHING`,
    [normalizePhone(env.admin.phone)],
  );

  if (!env.isProd && process.env.SEED_DEMO_ROSTER !== 'false') {
    for (const r of DEMO_ROSTER) {
      await query(
        `INSERT INTO college_records (name, branch, batch, regd_no, email, phone)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
        [r.name, r.branch, r.batch, r.regd_no, r.email, r.phone],
      );
    }
  }

  const { rows } = await query('SELECT count(*)::int AS n FROM faqs');
  if (rows[0].n === 0) {
    for (const f of FAQS) {
      await query('INSERT INTO faqs (question, answer, keywords, category) VALUES ($1, $2, $3, $4)',
        [f.question, f.answer, f.keywords, f.category]);
    }
    log(`✔ Seeded ${FAQS.length} chatbot answers`);
  }

  await seedCommunity({ quiet });
  await seedFundraisers({ quiet });

  log(`✔ Admin ready: ${env.admin.email}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  seed()
    .then(() => pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}
