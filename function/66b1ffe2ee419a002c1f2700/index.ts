import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"

export async function getAvailableProjectsAndCustomers(req, res) {
	const authorization = req.headers.get('authorization');
	const jwt = authorization ? authorization.split('Bearer ')[1] : null;

	Bucket.initialize({ identity: jwt })

	const projectRelations = ["customer", "project.products.product", "products.product"]

	const projects = await Bucket.data.getAll(env.PROJECT_BUCKET_ID, { queryParams: { filter: { status: "exist" }, relation: projectRelations } })

	const offers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID, { queryParams: { filter: { status: { $nin: ["deleted", "revised"] } } } })

	const availableProjects = []
	const availableCustomers = []

	projects.forEach((project) => {
		const currentProjectOffers = offers.filter(offer => offer.project == project._id)
		const allOffersProducts = currentProjectOffers.flatMap(offer => offer.products)

		if (project.products?.length > allOffersProducts.length)
			availableProjects.push(project)

		if (!availableCustomers.some(ac => ac._id == project.customer?._id)) {
			availableCustomers.push(project.customer)
		}
	});

	const resData = { availableProjects, availableCustomers }

	return res.status(201).send(resData);
}