import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build";

const maintenanceFaultsBucketId = env.MAINTENANCE_FAULTS_BUCKET_ID;
const notificationBucketId = env.NOTIFICATION_BUCKET_ID;

const maintenanceManagerId = "65291d7bffa6b3002d10dceb"

function insertNotification(title, description, user) {
    try {
        const notificationContent = { title, description, user };
        Bucket.data.insert(notificationBucketId, notificationContent);
    } catch (error) {
        console.error("Bildirim eklenirken hata oluştu", error);
    }
}

function updateFaultStatus(_id, updateData) {
    try {
        Bucket.data.patch(maintenanceFaultsBucketId, _id, updateData);
    } catch (error) {
        console.error("Arıza durumu güncellenirken hata oluştu", error);
    }
}

/**
 * @param {number} notificationPeriod - Wait time in seconds
 * @param {string} notificationState - Notification title
*/
async function sendMaintenanceNotifications(
    notificationPeriod,
    notificationState
) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY });

    const strategy = notificationStrategyMap[notificationState];

    if (!strategy) {
        console.warn(`No strategy defined for: ${notificationState}`);
        return;
    }

    const now = Date.now();

    const maintenanceFaults = await Bucket.data.getAll(maintenanceFaultsBucketId, {
        queryParams: {
            filter: {
                $and: [
                    { status: "exist" },
                    { is_fixed: { $in: [false, undefined, null] } },
                    { [notificationState]: { $in: [false, undefined, null] } }
                ]
            },
            relation: ["maintenance_unit"]
        }
    });

    for (const fault of maintenanceFaults) {
        const { _id, maintenance_unit, updated_date, is_accepted } = fault;

        const startTime = new Date(updated_date).getTime();
        const timeDifference = now - startTime;

        const isWaitingTimePassed = timeDifference >= notificationPeriod * 1000;

        if (!isWaitingTimePassed) continue;

        const result = strategy(is_accepted);

        if (!result) continue;

        updateFaultStatus(_id, result.status);

        const unitInfo = `Tesisat No: ${maintenance_unit.installation_number}. Bina Adı: ${maintenance_unit.building_name}.`

        insertNotification(`Yeni Arıza: ${unitInfo}`, result.message, maintenanceManagerId);
    }
}

const notificationStrategyMap = {
    notified: (is_accepted) => {

        const message = is_accepted
            ? "Arıza kabul edildi!"
            : "Yeni arıza eklendi ama kabul edilmedi.";

        const status = is_accepted
            ? { notified: true, updated_date: new Date().toISOString() }
            : { notified: true };

        return {
            status,
            message,
        };
    },
    first_reminder: (is_accepted) => {
        if (!is_accepted) return;

        return {
            message: "Arıza kabul edildi ancak son 1 saat içerisinde arızanın bakımı yapılmadı!",
            status: { first_reminder: true },
        };
    },
    second_reminder: (is_accepted) => {
        if (!is_accepted) return;

        return {
            message: "Arıza kabul edildi ancak son 2 saat içerisinde arızanın bakımı yapılmadı!",
            status: { second_reminder: true },
        };
    },
};

export function sendNotification() {
    const notificationSettings = [
        { period: 600, name: "notified" }, // 10 minutes
        { period: 3600, name: "first_reminder" }, // 1 hour
        { period: 7200, name: "second_reminder" }, // 2 hours
    ];

    notificationSettings.forEach((setting) => {
        sendMaintenanceNotifications(setting.period, setting.name);
    });
}