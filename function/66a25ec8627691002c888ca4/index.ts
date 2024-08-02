import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export async function setIfShouldMoveExpiredUnits() {
    Bucket.initialize({ apikey: env.SECRET_API_KEY });

    const data = await Bucket.data.getAll(env.MAINTENANCETRACKING_BUCKET_ID)

    data.forEach((item) => {
        Bucket.data.patch(env.MAINTENANCETRACKING_BUCKET_ID, item._id, { ...item, should_move_expired_units: true })
    })
}

export async function setIfCreateMonthlyPlan() {
    Bucket.initialize({ apikey: env.SECRET_API_KEY });

    const data = await Bucket.data.getAll(env.MAINTENANCETRACKING_BUCKET_ID)

    data.forEach((item) => {
        Bucket.data.patch(env.MAINTENANCETRACKING_BUCKET_ID, item._id, { ...item, should_create_monthly_plan: true })
    })
}