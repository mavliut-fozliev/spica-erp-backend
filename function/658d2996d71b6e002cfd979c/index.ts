import * as Bucket from "@spica-devkit/bucket";

const CLIENT_API_KEY = process.env.CLIENT_API_KEY;

const PAGES_BUCKET_ID = "6544bc6dd71b6e002cf6f476"

export default async function (change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY });

    const oldFieldFeatures = await Bucket.data.get(PAGES_BUCKET_ID, change.document._id).then(row => row.field_features) || []
    const oldFieldFeaturesNames = oldFieldFeatures?.map(field_feature => field_feature.field_name) || []
    const newFieldFeatures = Object.values(change.document.properties).map((p, i) => oldFieldFeaturesNames.includes(p.title) ?
        oldFieldFeatures.find(f => f.field_name === p.title)
        : { field_name: p.title, order: i })
        .filter(f => f.field_name !== "status")
    console.log(newFieldFeatures)
    Bucket.data.patch(PAGES_BUCKET_ID, change.document._id, {field_features: newFieldFeatures})
}