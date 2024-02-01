import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export default async function (change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY });

    const oldFieldFeatures = await Bucket.data.get(env.PAGES_BUCKET_ID, change.document._id).then(row => row.field_features) || []
    const oldFieldFeaturesNames = oldFieldFeatures?.map(field_feature => field_feature.field_name) || []
    const newFieldFeatures = Object.values(change.document.properties).map((p, i) => oldFieldFeaturesNames.includes(p.title) ?
        oldFieldFeatures.find(f => f.field_name === p.title)
        : { field_name: p.title, order: i })
        .filter(f => f.field_name !== "status")
    Bucket.data.patch(env.PAGES_BUCKET_ID, change.document._id, {field_features: newFieldFeatures})
}