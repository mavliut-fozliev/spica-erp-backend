import * as Bucket from "@spica-devkit/bucket";

const CLIENT_API_KEY = process.env.CLIENT_API_KEY;

const CUSTOMERS_BUCKET_ID = "651d309082063a002c6f9851"
const PROJECTS_BUCKET_ID = "651e842a82063a002c6fa24f"
const OFFERS_BUCKET_ID = "651d6a2882063a002c6f9ba3"
const ORDERS_BUCKET_ID = "6527b072ffa6b3002d10bfd3"
const PAGES_BUCKET_ID = "6544bc6dd71b6e002cf6f476"
const GANTTCHART_BUCKET_ID = "65489afcd71b6e002cf7406c"
const ORDERTRACKING_BUCKET_ID = '6560b7ccd71b6e002cf9654c'
const SAIS_BUCKET_ID = '655f2fd0d71b6e002cf9186e'
const ASSEMBLYPROJECTS_BUCKET_ID = '656dcec7d71b6e002cfa1b15'

export function addStatusFieldToBucket(change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY });
    if (change.document.category === "pages" && !change.document.properties.hasOwnProperty("status")) {
        Bucket.update(change.document._id, {
            ...change.document, properties: {
                ...change.document.properties, status: {
                    type: 'string',
                    title: 'status',
                    description: '-exist\n-deleted\n-archived',
                    default: 'exist',
                    enum: ["exist", "deleted", "archived"],
                    options: { position: 'right' }
                }
            }
        })
    }
}

export async function addBucketToPagesBucket(change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY });
    if (change.document._id === PAGES_BUCKET_ID || change.document.category !== "pages") return;
    const pages = await Bucket.data.getAll(PAGES_BUCKET_ID)
    for (let row of pages) {
        if (change.document._id === row._id) {
            return;
        }
    }
    Bucket.data.insert(PAGES_BUCKET_ID, {
        _id: change.document._id, title: change.document.title,
        description: change.document.description, order: change.document.order
    })
}

export async function deleteBucketFromPagesBucket(change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY });
    const pages = await Bucket.data.getAll(PAGES_BUCKET_ID)
    for (let row of pages) {
        if (change.documentKey === row._id) {
            Bucket.data.remove(PAGES_BUCKET_ID, change.documentKey)
            return;
        }
    }
}

export async function changeBucketOrder(change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY })
    const pagesBucketRows = await Bucket.data.getAll(PAGES_BUCKET_ID);
    const allBuckets = await Bucket.getAll();
    for (let bucketRow of pagesBucketRows) {
        for (let bucket of allBuckets) {
            if (bucket._id === bucketRow._id) {
                await Bucket.data.patch(PAGES_BUCKET_ID, bucketRow._id, { order: bucket.order })
            }
        }
    }
}

export async function changeOffersCustomer(change) {
    if (change.current.customer === change.previous.customer) return;
    Bucket.initialize({ apikey: CLIENT_API_KEY })
    const offers = await Bucket.data.getAll(OFFERS_BUCKET_ID)
    const relatedOffers = offers.filter(offer => offer.project === change.documentKey)
    relatedOffers.forEach(offer => {
        Bucket.data.patch(OFFERS_BUCKET_ID, offer._id, { customer: change.current.customer })
    })
}

export async function create_NewOrder_AssemblyProject_OrderTracking_SAIS(change) {
    Bucket.initialize({ apikey: CLIENT_API_KEY })
    if ((change.kind === 'update' || change.kind === 'insert') && change.current.agreement_signed) {
        const orders = await Bucket.data.getAll(ORDERS_BUCKET_ID)
        const order = orders.find(order => order.offer === change.current.offer)
        const offer = await Bucket.data.get(OFFERS_BUCKET_ID, change.current.offer, {
            queryParams: {
                relation: true,
            },
        })
        if (!order) {
            const newOrder = await Bucket.data.insert(ORDERS_BUCKET_ID, {
                name: (offer.project.name).slice(0, 30) + " - " + offer.reference_number,
                offer: offer._id,
                customer: offer.customer._id,
                project: offer.project._id,
                product: offer.product__from__project._id,
                product_count: offer.product_count,
                product_serial_number: Array.from({ length: offer.product_count }, (_, index) => offer.reference_number + "~" + (index + 1).toString())
            })
            Bucket.data.insert(ORDERTRACKING_BUCKET_ID, {
                ordered_project: newOrder?._id
            })
            Bucket.data.insert(SAIS_BUCKET_ID, {
                ordered_project: newOrder?._id
            })
            Bucket.data.insert(ASSEMBLYPROJECTS_BUCKET_ID, {
                ordered_project: newOrder?._id
            })
        }
    }
}

export async function onD(change) {
    console.log(change)
}