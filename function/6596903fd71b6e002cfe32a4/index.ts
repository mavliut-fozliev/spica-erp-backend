import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"
import dayjs from "dayjs";

//Projects
export async function onProjectsDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const currentProject = change.current
    const offers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID)
    const targetOffers = offers.filter(offer => offer.project === change.documentKey)
    if (change.kind === "update") {
        currentProject.status === "deleted" ?
            targetOffers.forEach(offer =>
                Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
                    customer: null,
                    related_person: "",
                    related_person_phone: "",
                    related_person_role: "",
                }).catch(console.error)
            ) : targetOffers.forEach(offer =>
                Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
                    customer: currentProject.customer,
                    related_person: currentProject.related_person,
                    related_person_phone: currentProject.related_person_phone,
                    related_person_role: currentProject.related_person_role,
                }))
    }
}

//Offers
export async function changeOfferStandbyTime(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const offers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID)
    offers.forEach(offer => {
        const currentDate = new Date();
        const targetDate = new Date(offer.created_date);
        const differenceInMilliseconds = currentDate.getTime() - targetDate.getTime();
        const differenceInDays = Math.round(differenceInMilliseconds / (1000 * 60 * 60 * 24));
        Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
            standby_time: differenceInDays.toString() + " gün",
        })
    })
}

//Contracts
export async function onContractsDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    if ((change.kind === 'update' || change.kind === 'insert') && change.current.agreement_signed) {
        const orders = await Bucket.data.getAll(env.ORDERS_BUCKET_ID)
        const order = orders.find(order => order.offer === change.current.offer)
        const offer = await Bucket.data.get(env.OFFERS_BUCKET_ID, change.current.offer, {
            queryParams: {
                relation: true,
            },
        })
        if (!order) {
            const newOrder = await Bucket.data.insert(env.ORDERS_BUCKET_ID, {
                name: (offer.project.name).slice(0, 30) + " - " + offer.reference_number,
                offer: offer._id,
                customer: offer.customer._id,
                project: offer.project._id,
                product: offer.product__from__project._id,
                product_count: offer.product_count,
                product_serial_number: Array.from({ length: offer.product_count }, (_, index) =>
                    ({ serial_number: offer.reference_number + " ~ No " + (index + 1).toString() }))
            })
            Bucket.data.insert(env.ORDERTRACKING_BUCKET_ID, {
                ordered_project: newOrder?._id
            })
            Bucket.data.insert(env.SAIS_BUCKET_ID, {
                ordered_project: newOrder?._id
            })
            Bucket.data.insert(env.ASSEMBLYPROJECTS_BUCKET_ID, {
                name: (offer.project.name)?.slice(0, 30) + " - " + offer.reference_number,
                ordered_project: newOrder?._id
            })
            offer.product_count?.forEach((prod, index) => {
                Bucket.data.insert(env.FIELDINSPECTIONS_BUCKET_ID, {
                    project_and_product_serial_number: (offer.project.name).slice(0, 30) + " - " + offer.reference_number +
                        ", No: " + offer.reference_number + " ~ No " + (index + 1).toString()
                })
            })
        }
    }
}

//GanttChart
export async function onGanttChartDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const product_serial_number = change.current.product_serial_number
    const assemblyProject = await Bucket.data.get(env.ASSEMBLYPROJECTS_BUCKET_ID, change.current.order_name, { queryParams: { relation: true } })
    const order = await Bucket.data.get(env.ORDERS_BUCKET_ID, assemblyProject.ordered_project._id)
    await Bucket.data.patch(env.ORDERS_BUCKET_ID, assemblyProject.ordered_project._id, {
        product_serial_number: order.product_serial_number.map(
            row => row.serial_number === product_serial_number ? { ...row, added_to_gantt_chart: true } : row
        )
    })
    const updatedOrder = await Bucket.data.get(env.ORDERS_BUCKET_ID, order._id)
    const allProductsAddedToGanttChart = updatedOrder.product_serial_number.every(elem => elem.added_to_gantt_chart === true)
    if (allProductsAddedToGanttChart) {
        Bucket.data.patch(env.ASSEMBLYPROJECTS_BUCKET_ID, change.current.order_name, { fully_added_to_gantt_chart: true })
    }
}

//ProgressPayments
export async function onProgressPaymentsDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    if ((change.kind === 'update' || change.kind === 'insert')) {
        const project = await Bucket.data.get(env.ORDERS_BUCKET_ID, change.current.project_name)
        Bucket.data.patch(change.bucket, change.current._id, { name: project.name })
    }
}

//MonthlyProgressPayments
export async function onMonthlyProgressPaymentsDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const targetProjects = change.current.payments.map(p => p.project)
    const monthlyProgressPayments = await Bucket.data.getAll(env.MONTHLYPROGRESSPAYMENTS_BUCKET_ID, {
        queryParams: {
            filter: { status: { $ne: "deleted" } }
        }
    })
    targetProjects.forEach(async (project) => {
        const payments = []
        let newPricePerFloor = 0
        let singlePayment = 0
        monthlyProgressPayments.forEach(p => {
            p.payments?.forEach(payment => {
                if (payment.project === project) {
                    newPricePerFloor = payment.price_per_floor
                    singlePayment = payment.payment
                    payments.push({
                        fuel_cost: payment.fuel,
                        fuel_description: payment.work_status + " " + payment.work_percentage,
                        payment: payment.payment,
                        payment_description: payment.price_per_floor.toString(),
                        payment_date: payment.date,
                    })
                }
            })
        })

        const currentProject = await Bucket.data.get(env.PROGRESSPAYMENTS_BUCKET_ID, project);

        const oldPricePerFloor = currentProject.price_per_floor

        const payment_made =
            (payments.reduce((acc, current) => acc + (current.payment || 0) + (current.fuel_cost || 0), 0) || 0)
            + (currentProject.advance_payment || 0);

        const price_difference_payment = ((newPricePerFloor - oldPricePerFloor) / newPricePerFloor) * singlePayment

        const finality = (currentProject.total_price_from_this_product - payment_made);

        Bucket.data.patch(env.PROGRESSPAYMENTS_BUCKET_ID, project, { payments, payment_made, price_difference_payment, finality })
    })
}

//Employees
export async function changeEmployeesEveryDay(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })

    const employees = await Bucket.data.getAll(env.EMPLOYEES_BUCKET_ID)
    employees.forEach(employee => {
        const difference = dayjs().diff(dayjs(employee.start_date), "year")
        const total_leave = difference >= 15 ? (25 * 9) : difference >= 10 ? (22 * 9) : difference >= 5 ? (18 * 9) : (14 * 9);
        const remaining_leave = `${((total_leave - employee.used_leave) / 9).toFixed(1).replace(/\.?0+$/, "")} gün (${total_leave -
            employee.used_leave} saat)`;

        Bucket.data.patch(env.EMPLOYEES_BUCKET_ID, employee._id, {
            total_leave,
            remaining_leave,
        })
    })
}

export async function changeEmployeesEveryYear(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })

    const employees = await Bucket.data.getAll(env.EMPLOYEES_BUCKET_ID)
    employees.forEach(employee => {
        const remaining_leave = `${employee.total_leave / 9} gün (${employee.total_leave} saat)`;
        const used_leave = 0

        Bucket.data.patch(env.EMPLOYEES_BUCKET_ID, employee._id, {
            remaining_leave,
            used_leave
        })
    })
}

//AnnualLeave
export async function onAnnualLeaveDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })

    if ((change.kind === 'update' || change.kind === 'insert')) {
        const employeeId = change.current.employee
        const currentYear = new Date().getFullYear();
        const regexPattern = new RegExp(`^${currentYear}`);

        const annualLeaves = await Bucket.data.getAll(env.ANNUALLEAVE_BUCKET_ID, {
            queryParams: {
                filter: {
                    status: { $ne: "deleted" }, employee: { $eq: employeeId }, manager_approval: { $eq: true },
                    department_head_approval: { $eq: true },// start_date: { $regex: regexPattern}
                }
            }
        })
        console.log(annualLeaves)

        const used_leave = annualLeaves.reduce((sum, leave) => sum + leave.leave_amount, 0);
        const fmi_used_leave = annualLeaves.reduce((sum, leave) => sum + leave.fmi_leave_amount, 0);

        const employee = await Bucket.data.get(env.EMPLOYEES_BUCKET_ID, employeeId)

        Bucket.data.patch(env.EMPLOYEES_BUCKET_ID, employeeId, {
            used_leave,
            fmi_used_leave,
            remaining_leave: `${((employee.total_leave - used_leave) / 9).toFixed(1).replace(/\.?0+$/, "")} gün (${employee.total_leave - used_leave} saat)`
        })
    }
}

//Overtime
export async function onOvertimeDataChange(change) {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })

    if ((change.kind === 'update' || change.kind === 'insert')) {
        const employeeId = change.current.employee
        const currentYear = new Date().getFullYear();
        const regexPattern = new RegExp(`^${currentYear}`);

        const overtimes = await Bucket.data.getAll(env.OVERTIME_BUCKET_ID, {
            queryParams: {
                filter: {
                    status: { $ne: "deleted" }, employee: { $eq: employeeId }, manager_approval: { $eq: true },
                    department_head_approval: { $eq: true },// start_date: { $regex: regexPattern}
                }
            }
        })

        const fmi_total_leave = overtimes.reduce((sum, overtime) => sum + overtime.overtime_amount, 0);

        const employee = await Bucket.data.get(env.EMPLOYEES_BUCKET_ID, employeeId)

        const fmi_remaining_leave = `${((fmi_total_leave - employee.fmi_used_leave) / 9)
            .toFixed(1).replace(/\.?0+$/, "")} gün (${fmi_total_leave - employee.fmi_used_leave} saat)`

        Bucket.data.patch(env.EMPLOYEES_BUCKET_ID, employeeId, {
            fmi_total_leave,
            fmi_remaining_leave
        })
    }
}