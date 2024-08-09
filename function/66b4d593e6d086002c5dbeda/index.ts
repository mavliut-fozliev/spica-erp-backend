import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export async function getAvailableProjects(req, res) {
    const jwt = req.headers.get('authorization');
    Bucket.initialize({ identity: jwt })

    const offers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID, { queryParams: { filter: { status: "confirmed" }, relation: ["project.customer"] } })
    const offerProjects = offers.map(o => o.project)

    const contracts = await Bucket.data.getAll(env.CONTRACTS_BUCKET_ID, { queryParams: { filter: { status: { $ne: "deleted" } }, relation: true } })
    const contractProjects = contracts.map(c => c.project)

    const availableProjects = []

    offerProjects.forEach(project => {
        const haveContract = contractProjects.some(p => p?._id === project?._id)
        const haveSameId = availableProjects.some(ap => ap._id == project?._id)

        if (!haveContract && !haveSameId) {
            availableProjects.push(project)
        }
    })

    return res.status(201).send(availableProjects);
}