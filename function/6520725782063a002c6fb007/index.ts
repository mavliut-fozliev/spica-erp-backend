import * as Bucket from "@spica-devkit/bucket";
import * as Storage from "@spica-devkit/storage";

const CLIENT_API_KEY = process.env.CLIENT_API_KEY;

const customerBucketId = "651d309082063a002c6f9851";
const projectBucketId = "651e842a82063a002c6fa24f";
const userBucketId = "6527f268ffa6b3002d10cc50";
const notificationBucketId = "6527f226ffa6b3002d10cc44";

export async function addUserToBucket(change) {
  Bucket.initialize({ apikey: CLIENT_API_KEY });

  if (change.document.attributes?.role === "user") {
    Bucket.data.insert(userBucketId, {
      identifier: change.document.identifier,
      identity_id: change.document._id,
      name: change.document.attributes.name,
      surname: change.document.attributes.surname,
    });
  }
}

export async function deleteUserFromBucket(change) {
  Bucket.initialize({ apikey: CLIENT_API_KEY });

  const user = await Bucket.data.getAll(userBucketId, {
    queryParams: {
      filter: {
        identity_id: change.documentKey,
      },
    },
  });
  if (user[0]) {
    Bucket.data.remove(userBucketId, user[0]._id);
  }
}

export async function addProjectToNotificationBucket(change) {
  Bucket.initialize({ apikey: CLIENT_API_KEY });

  const users = await Bucket.data.getAll(userBucketId);
  users.map((user) => {
    Bucket.data.insert(notificationBucketId, { title: change.current.name, user: user._id });
  });
}

export async function addApprovedOfferToNotificationBucket(change) {
  Bucket.initialize({ apikey: CLIENT_API_KEY });

  if (change.previous.status !== change.current.status && change.current.status === "approved") {
    const users = await Bucket.data.getAll(userBucketId);
    users.map((user) => {
      Bucket.data.insert(notificationBucketId, { title: change.current.name, user: user._id });
    });
  }
}

function converDateObjectToString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
}

export async function addReminderNotification() {
  Bucket.initialize({ apikey: CLIENT_API_KEY });

  const users = await Bucket.data.getAll(userBucketId);

  const reminderProjects = await Bucket.data.getAll(projectBucketId, {
    queryParams: {
      filter: {
        $and: [{ $or: [{ deleted: { $exists: false } }, { deleted: { $eq: false } }] }, { reminder: { $exists: true } }],
      },
    },
  });
  const currentDate = converDateObjectToString(new Date());
  reminderProjects.map((project) => {
    const reminder = project.reminder;
    if (
      reminder.slice(0, 4) === currentDate.slice(0, 4) &&
      reminder.slice(5, 7) === currentDate.slice(5, 7) &&
      reminder.slice(8, 10) === currentDate.slice(8, 10) &&
      reminder.slice(11, 13) === currentDate.slice(11, 13) &&
      reminder.slice(14, 16) === currentDate.slice(14, 16)
    ) {
      users.map((user) => {
        Bucket.data.insert(notificationBucketId, { title: project.name, user: user._id });
      });
    }
  });
}

export async function sendMail(req, res) {
  const data = req.body;
  const nodemailer = require("nodemailer");

  const stringData = data.filter((obj) => obj.hasOwnProperty("name"));
  const correctedData = stringData.map((obj) => ({ ...obj, data: obj.data?.toString("utf-8") }));
  const stringDataObj = {};
  correctedData.forEach(({ name, data }) => {
    stringDataObj[name] = data;
  });

  const attachments = data.filter((obj) => obj.hasOwnProperty("filename"));
  const correctedAttachments = attachments.map((obj) => ({ filename: data.filename, content: obj.data, contentType: obj.type }));

  Storage.initialize({ identity: stringDataObj.identity });

  const file = await Storage.get(stringDataObj.fileId);

  const signature = await Storage.get("66349a4e3931f4002bf6c8a1");

  const transporter = nodemailer.createTransport({
    host: "mail.lcn.com",
    port: 465,
    secure: true,
    auth: {
      user: "test@kutlaymuhendislik.com",
      pass: "Deneme.9876",
    },
    tls: {
      rejectUnauthorized: true,
    },
  });

  const mailOptions = {
    from: "test@kutlaymuhendislik.com",
    to: stringDataObj.to,
    cc: stringDataObj.cc,
    subject: stringDataObj.title,
    html: `
            <div>${stringDataObj.text}</div>
            <div style="margin-top: 20px">--</div>
            <div><img src="${signature.url}" style="width: 80%; height: auto;"></div>
        `,
    attachments: [...correctedAttachments, { filename: file.name, path: file.url }],
  };

  console.log("mailOptions: ", mailOptions);

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.error("error: ", error);
    }
    console.log("Message sent: ", info.messageId);
  });

  res.status(200).send();
}
