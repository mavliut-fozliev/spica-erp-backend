import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export async function getAvailableProjects(req, res) {
    const jwt = req.headers.get('authorization');
    Bucket.initialize({ identity: jwt })

    const projectRelations = ["customer", "project.products.product", "products.product"]

    const projects = await Bucket.data.getAll(env.PROJECT_BUCKET_ID, { queryParams: { filter: { status: "exist" }, relation: projectRelations } })

    const offers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID, { queryParams: { filter: { status: { $nin: ["deleted", "revised"] } } } })

    const availableProjects = []

    projects.forEach((project) => {
        const currentProjectOffers = offers.filter(offer => offer.project == project._id)
        const allOffersProducts = currentProjectOffers.flatMap(offer => offer.products)

        if (project.products?.length > allOffersProducts.length) {
            availableProjects.push(project)
        }
    });

    return res.status(201).send(availableProjects);
}