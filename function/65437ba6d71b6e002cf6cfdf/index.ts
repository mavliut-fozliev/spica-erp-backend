import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export function addStatusFieldToBucket(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY });
    if (change.document.category === "pages" && !change.document.properties.hasOwnProperty("status")) {
        Bucket.update(change.document._id, {
            ...change.document, properties: {
                ...change.document.properties, status: {
                    type: 'string',
                    title: 'status',
                    default: 'exist',
                    enum: ["exist", "deleted"],
                }
            }
        })
    }
}

export async function addBucketToPagesBucket(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY });
    if (change.document._id === env.PAGES_BUCKET_ID || change.document.category !== "pages") return;
    const pages = await Bucket.data.getAll(env.PAGES_BUCKET_ID)
    for (let row of pages) {
        if (change.document._id === row._id) {
            return;
        }
    }
    Bucket.data.insert(env.PAGES_BUCKET_ID, {
        _id: change.document._id, title: change.document.title,
        description: change.document.description, order: change.document.order
    })
}

export async function deleteBucketFromPagesBucket(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY });
    const pages = await Bucket.data.getAll(env.PAGES_BUCKET_ID)
    for (let row of pages) {
        if (change.documentKey === row._id) {
            Bucket.data.remove(env.PAGES_BUCKET_ID, change.documentKey)
            return;
        }
    }
}

export async function changeBucketOrder(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const pagesBucketRows = await Bucket.data.getAll(env.PAGES_BUCKET_ID);
    const allBuckets = await Bucket.getAll();
    for (let bucketRow of pagesBucketRows) {
        for (let bucket of allBuckets) {
            if (bucket._id === bucketRow._id) {
                await Bucket.data.patch(env.PAGES_BUCKET_ID, bucketRow._id, { order: bucket.order })
            }
        }
    }
}
