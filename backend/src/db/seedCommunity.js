import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { pool, query, tx } from './pool.js';

export async function seedCommunity({ quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);

  // 1. Ensure students exist in users table
  const defaultPasswordHash = await bcrypt.hash('Student@123', 10);

  // Dev bypass user
  await query(
    `INSERT INTO users (name, phone, password_hash, branch, batch, regd_no)
     VALUES ('Dev Student', '9998887776', $1, 'Computer Science & Engineering', '2022-2026', '22CSE099')
     ON CONFLICT (phone) DO UPDATE SET
       name = 'Dev Student',
       branch = 'Computer Science & Engineering',
       batch = '2022-2026',
       regd_no = '22CSE099'`,
    [defaultPasswordHash],
  );

  // Roster demo users
  const { rows: roster } = await query('SELECT * FROM college_records');
  for (const r of roster) {
    await query(
      `INSERT INTO users (college_record_id, name, email, phone, password_hash, branch, batch, regd_no)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (phone) DO UPDATE SET
         college_record_id = EXCLUDED.college_record_id,
         name = EXCLUDED.name,
         branch = EXCLUDED.branch,
         batch = EXCLUDED.batch,
         regd_no = EXCLUDED.regd_no`,
      [r.id, r.name, r.email, r.phone, defaultPasswordHash, r.branch, r.batch, r.regd_no],
    );
  }

  const { rows: users } = await query('SELECT id, name, phone FROM users');
  const userByPhone = Object.fromEntries(users.map((u) => [u.phone, u]));
  const userByName = Object.fromEntries(users.map((u) => [u.name, u]));

  const devUser = userByPhone['9998887776'];
  const aarav = userByPhone['9000000001'] || userByName['Aarav Kumar'];
  const priya = userByPhone['9000000002'] || userByName['Priya Singh'];
  const rohit = userByPhone['9000000003'] || userByName['Rohit Mahato'];
  const sneha = userByPhone['9000000004'] || userByName['Sneha Oraon'];

  const { rows: admins } = await query('SELECT id FROM admins LIMIT 1');
  const adminId = admins[0]?.id || null;

  // Clear existing seeded problems to ensure clean 2 admin + 4 everyone count
  await query(`DELETE FROM posts WHERE title IN (
    'Unidentified person loitering near Hostel 5 pathway after 9 PM',
    'Contaminated drinking water cooler causing severe stomach infections in Hostel 2',
    'Multiple non-functional streetlights on main academic road between Admin block and IT building',
    'Broken high-voltage electrical switchboard sparking in Deshpande Auditorium corridor',
    'Unfiltered drinking water and unhygienic food storage in Central Mess 2',
    'Campus e-rickshaw shuttle timing mismatch during morning 8:00 AM class rush'
  )`);

  const problemsToSeed = [
    // ══════════════ 2 ADMIN ONLY PROBLEMS ══════════════
    {
      user_id: devUser.id,
      title: 'Unidentified person loitering near Hostel 5 pathway after 9 PM',
      description: 'Over the last three nights, an unidentified individual without campus ID has been loitering and following female students walking from Central Library towards Hostel 5 between 9:15 PM and 10:00 PM. The stretch near the mechanical workshop has poor illumination. Please deploy guards or security patrol along this route immediately.',
      category: 'harassment',
      severity: 4,
      visibility: 'admin',
      status: 'in_progress',
      created_at_offset: 'interval \'2 days\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted privately (only the admin can see it)', offset: 'interval \'2 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'marked_for_solving', note: 'Complaint forwarded to Chief Proctor & Security In-Charge.', offset: 'interval \'1 day 18 hours\'' },
        { actor: 'admin', admin_id: adminId, status: 'in_progress', note: 'Two security personnel stationed at Mechanical Workshop junction from 8:30 PM to 11 PM.', offset: 'interval \'1 day\'' },
      ],
      likes: [],
      comments: [],
    },
    {
      user_id: rohit.id,
      title: 'Contaminated drinking water cooler causing severe stomach infections in Hostel 2',
      description: 'The water cooler on the second floor of Hostel 2 B-block has visible discoloration and a metallic smell. At least four wing-mates have fallen ill with severe gastrointestinal infection since yesterday. Requesting immediate maintenance and water testing before more students fall sick.',
      category: 'health',
      severity: 3,
      visibility: 'admin',
      status: 'under_review',
      created_at_offset: 'interval \'3 days\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted privately (only the admin can see it)', offset: 'interval \'3 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'marked_for_solving', note: 'Estate maintenance team assigned to inspect water purifier and filters.', offset: 'interval \'2 days 12 hours\'' },
        { actor: 'admin', admin_id: adminId, status: 'under_review', note: 'Water sample sent to district lab for bacteriological testing. Cooler isolated.', offset: 'interval \'1 day\'' },
      ],
      likes: [],
      comments: [],
    },

    // ══════════════ 4 EVERYONE PROBLEMS ══════════════
    {
      user_id: aarav.id,
      title: 'Multiple non-functional streetlights on main academic road between Admin block and IT building',
      description: 'Four consecutive high-mast streetlights have been completely dark along the primary pathway connecting the Admin Block to the IT Building. With evening labs ending at 7:30 PM, this road becomes pitch dark and hazardous for pedestrians and cyclists alike.',
      category: 'safety',
      severity: 3,
      visibility: 'everyone',
      status: 'in_progress',
      created_at_offset: 'interval \'4 days\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted for everyone', offset: 'interval \'4 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'marked_for_solving', note: 'Complaint logged with Electrical Maintenance department.', offset: 'interval \'3 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'in_progress', note: 'Electrician scheduled underground cable replacement work today.', offset: 'interval \'2 days\'' },
      ],
      likes: [priya.id, rohit.id, sneha.id],
      comments: [
        { user_id: priya.id, body: 'Faced this yesterday while returning from CSE lab. Extremely dark near the speed breaker.', offset: 'interval \'3 days 6 hours\'' },
        { user_id: rohit.id, body: 'Please fix this urgently, two cycles collided here earlier this week.', offset: 'interval \'2 days 18 hours\'' },
        { user_id: sneha.id, body: 'Even the backup solar lights along this stretch are dead.', offset: 'interval \'1 day 12 hours\'' },
      ],
    },
    {
      user_id: sneha.id,
      title: 'Broken high-voltage electrical switchboard sparking in Deshpande Auditorium corridor',
      description: 'The main distributor box outside Hall 1 is exposed with damaged casing and was sparking during afternoon rains. High risk of electrical shock for anyone passing by.',
      category: 'infrastructure',
      severity: 4,
      visibility: 'everyone',
      status: 'solved',
      admin_resolved: true,
      student_resolved: false,
      created_at_offset: 'interval \'5 days\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted for everyone', offset: 'interval \'5 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'in_progress', note: 'Power isolated to the affected corridor.', offset: 'interval \'4 days\'' },
        { actor: 'admin', admin_id: adminId, status: 'solved', note: 'Switchboard replaced with sealed weatherproof panel and tested.', offset: 'interval \'1 day 6 hours\'' },
      ],
      likes: [aarav.id, priya.id, rohit.id, devUser.id],
      comments: [
        { user_id: aarav.id, body: 'Saw sparks while heading for seminar! Very dangerous.', offset: 'interval \'4 days 12 hours\'' },
        { user_id: rohit.id, body: 'Good to see prompt isolation of power.', offset: 'interval \'3 days\'' },
      ],
    },
    {
      user_id: rohit.id,
      title: 'Unfiltered drinking water and unhygienic food storage in Central Mess 2',
      description: 'Vegetables are stored in open humid crates near washing basins, and flies have been observed around the serving counter. Several hostel residents have complained about stomach aches over the weekend. Need mess committee inspection.',
      category: 'food',
      severity: 2,
      visibility: 'everyone',
      status: 'open',
      created_at_offset: 'interval \'18 hours\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted for everyone', offset: 'interval \'18 hours\'' },
      ],
      likes: [aarav.id, priya.id, sneha.id],
      comments: [
        { user_id: aarav.id, body: 'I had to skip dinner yesterday because of this. Mess council needs to visit unannounced.', offset: 'interval \'12 hours\'' },
        { user_id: priya.id, body: 'Support this! We raised this with the warden last month too.', offset: 'interval \'6 hours\'' },
      ],
    },
    {
      user_id: priya.id,
      title: 'Campus e-rickshaw shuttle timing mismatch during morning 8:00 AM class rush',
      description: 'Only 2 out of 6 campus shuttles operate between 7:45 AM and 8:15 AM from Girls Hostel gate to Main Building, causing overcrowding and students being late for first period lectures. Requesting better frequency during peak morning slots.',
      category: 'transport',
      severity: 1,
      visibility: 'everyone',
      status: 'open',
      created_at_offset: 'interval \'8 hours\'',
      updates: [
        { actor: 'owner', status: 'open', note: 'Problem posted for everyone', offset: 'interval \'8 hours\'' },
      ],
      likes: [aarav.id, rohit.id],
      comments: [
        { user_id: sneha.id, body: 'Adding one more vehicle from 7:45 AM would solve the rush completely.', offset: 'interval \'4 hours\'' },
      ],
    },
  ];

  for (const p of problemsToSeed) {
    const { rows: [post] } = await query(
      `INSERT INTO posts (user_id, title, description, category, severity, images, visibility, status, admin_resolved, student_resolved, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now() - ${p.created_at_offset}, now() - ${p.created_at_offset})
       RETURNING id`,
      [
        p.user_id,
        p.title,
        p.description,
        p.category,
        p.severity,
        [],
        p.visibility,
        p.status,
        Boolean(p.admin_resolved),
        Boolean(p.student_resolved),
      ],
    );

    // Updates
    for (const u of p.updates) {
      await query(
        `INSERT INTO post_updates (post_id, actor, admin_id, status, note, created_at)
         VALUES ($1, $2, $3, $4, $5, now() - ${u.offset})`,
        [post.id, u.actor, u.admin_id || null, u.status, u.note || null],
      );
    }

    // Likes
    for (const uid of p.likes) {
      await query(
        `INSERT INTO reactions (post_id, user_id, type, created_at)
         VALUES ($1, $2, 'like', now() - interval '1 day')
         ON CONFLICT (post_id, user_id) DO NOTHING`,
        [post.id, uid],
      );
    }

    // Comments
    for (const c of p.comments) {
      await query(
        `INSERT INTO comments (post_id, user_id, body, created_at)
         VALUES ($1, $2, $3, now() - ${c.offset})`,
        [post.id, c.user_id, c.body],
      );
    }
  }

  log('✔ Seeded 2 Admin-only problems and 4 Everyone problems with updates, likes, and comments');
}

if (process.argv[1] && process.argv[1].endsWith('seedCommunity.js')) {
  seedCommunity()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
