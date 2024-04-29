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
                    options: { position: "bottom" }
                }
            }
        })
    }
}
