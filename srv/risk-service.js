
// Import the cds facade object (https://cap.cloud.sap/docs/node.js/cds-facade)
const cds = require('@sap/cds'); //Esta línea importa el módulo @sap/cds y lo asigna a la variable cds

// The service implementation with all service handlers
//define un nuevo servicio y lo exporta como módulo
module.exports = cds.service.impl(async function () {

    // Define constants for the Risk and BusinessPartner entities from the risk-service.cds file
    const { Risks, BusinessPartners } = this.entities;

    // This handler will be executed directly AFTER a READ operation on RISKS
    // With this we can loop through the received data set and manipulate the single risk entries
    this.after("READ", Risks, (data) => {
        // Convert to array, if it's only a single risk, so that the code won't break here
        const risks = Array.isArray(data) ? data : [data];

        // Looping through the array of risks to set the virtual field 'criticality' that you defined in the schema
        risks.forEach((risk) => {
            
            if (risk.impact >= 100000) {
                risk.criticality = 1;
            } else {
                risk.criticality = 2;
            }
            // console.log("Risk",`${risk}`);
            // console.dir(risk);
            // set criticality for priority
            switch (risk.prio_code) {
                case 'H':
                    risk.PrioCriticality = 1;
                    break;
                case 'M':
                    risk.PrioCriticality = 2;
                    break;
                case 'L':
                    risk.PrioCriticality = 3;
                    break;
                default:
                    break;
            }

        })
    })
    
    // Esta línea establece una conexión a un servicio remoto llamado API_BUSINESS_PARTNER
    BPsrv = await cds.connect.to("API_BUSINESS_PARTNER");

    /* Event-handler for read-events on the BusinessPartners entity.
    Each request to the API Business Hub requires the apikey in the header.*/
    // Esta línea define un manejador de eventos que se ejecutará cuando se realice una operación de lectura en la entidad BusinessPartners
    this.on("READ", BusinessPartners, async (req) => {

        // The API Sandbox returns alot of business partners with empty names. We don't want them in our application
        // Esta línea agrega una condición a la solicitud de lectura para que solo se devuelvan los registros de socios de negocio que tengan un nombre y un apellido no vacíos.
        req.query.where(`LastName <> '' and FirstName <> '' `);

        return await BPsrv.transaction(req).send({
            query: req.query,
            headers: {
                apikey: process.env.apikey,
            },
        });
    });

   
    // Risks?$expand=bp (Expand on BusinessPartner)
    this.on("READ", Risks, async (req, next) => {
        /*
         Check whether the request wants an "expand" of the business partner
         As this is not possible, the risk entity and the business partner entity are in different systems (SAP BTP and S/4 HANA Cloud), 
         if there is such an expand, remove it
       */
      //Esta línea verifica si la solicitud de lectura req tiene una propiedad SELECT.columns. 
      //Si no la tiene, se devuelve la función next para continuar con la ejecución del código
        if (!req.query.SELECT.columns) return next();

        //Esta línea busca el índice de la columna que tiene una propiedad expand y un valor ref que sea igual a "bp". 
        //Esto se hace para verificar si la solicitud de lectura incluye una expansión de la entidad BusinessPartner.
        const expandIndex = req.query.SELECT.columns.findIndex(
            ({ expand, ref }) => expand && ref[0] === "bp"
        );

        //Esta línea verifica si el índice de la columna encontrada es menor que 0. Si es así, se devuelve la función next
        // para continuar con la ejecución del código.
        if (expandIndex < 0) return next();

        //Esta línea elimina la columna que tiene la propiedad expand y el valor ref igual a "bp" de la solicitud de lectura
        req.query.SELECT.columns.splice(expandIndex, 1);

        // Make sure bp_BusinessPartner (ID) will be returned
        //verifica si la propiedad columns de la solicitud de lectura req.query.SELECT contiene una columna que tenga 
        //una propiedad ref igual a "bp_BusinessPartner".
        if (!req.query.SELECT.columns.find((column) =>
            column.ref.find((ref) => ref == "bp_BusinessPartner")
        )
        ) {
            req.query.SELECT.columns.push({ ref: ["bp_BusinessPartner"] });
        }
//en resumen, verifica si la solicitud de lectura incluye una columna que tenga una propiedad ref igual a 
//"bp_BusinessPartner". Si no la incluye, agrega una nueva columna con esta propiedad a la solicitud de lectura.
        const risks = await next();

        //función que convierte un valor en un array si no es ya un array.
        const asArray = x => Array.isArray(x) ? x : [x];

        // Request all associated BusinessPartners
        //Obtiene los IDs de los socios de negocio asociados con los riesgos obtenidos en la operación de lectura.
        const bpIDs = asArray(risks).map(risk => risk.bp_BusinessPartner);

        //Esta línea envía una solicitud de lectura al servicio de BusinessPartner para obtener los datos de los 
        //BusinessPartner asociados con los IDs obtenidos en la operación de lectura.
        const BusinessPartner = await BPsrv.transaction(req).send({
            query: SELECT.from(this.entities.BusinessPartners).where({ BusinessPartner: bpIDs }),
            headers: {
                apikey: process.env.apikey,
            }
        });

        // Convert in a map for easier lookup
        const bpMap = {};
        for (const businessPartner of BusinessPartner)
            bpMap[businessPartner.BusinessPartner] = businessPartner;

        // Add BusinessPartners to result
        for (const note of asArray(risks)) {
            note.bp = bpMap[note.bp_BusinessPartner];
        }

        return risks;
    });

});



