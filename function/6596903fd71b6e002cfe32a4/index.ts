import * as Bucket from "@spica-devkit/bucket";
import { env } from "../../6544faf5d71b6e002cf70b78/.build"
import dayjs from "dayjs";

//Projects
export async function onProjectsDataChange(change) {
    if (change.kind === "update") {
        Bucket.initialize({ apikey: env.CLIENT_API_KEY })
        const currentProject = change.current
        const targetOffers = await Bucket.data.getAll(env.OFFERS_BUCKET_ID,
            {
                queryParams: {
                    filter: {
                        project: { $eq: change.documentKey }
                    }
                }
            }
        )
        currentProject.status === "deleted" ?
            targetOffers.forEach(offer =>
                Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
                    customer: null,
                }).catch(console.error)
            ) : targetOffers.forEach(offer =>
                Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
                    customer: currentProject.customer,
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
        const differenceInDays = Math.round(differenceInMilliseconds / (1000 * 3600 * 24));
        Bucket.data.patch(env.OFFERS_BUCKET_ID, offer._id, {
            standby_time: differenceInDays.toString() + " gün",
        })
    })
}

//MonthlyProgressPayments
export async function addTeamsEveryMonth() {
    Bucket.initialize({ apikey: env.CLIENT_API_KEY })
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

    const fieldTeams = await Bucket.data.getAll(env.FIELDTEAMS_BUCKET_ID)
    const currentYear = dayjs().year()
    const currentMonth = months[dayjs().month()]

    fieldTeams.forEach(fieldTeam => {
        const newDocument = { year: currentYear, month: currentMonth, team_name: fieldTeam._id }
        Bucket.data.insert(env.MONTHLYPROGRESSPAYMENTS_BUCKET_ID, newDocument)
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