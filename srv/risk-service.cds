//importamos un módulo llamado riskmanagement desde el fichero schema.cds. Se renombra el modulo como rm
using {riskmanagement as rm} from '../db/schema';

@path: 'service/risk' //define la ruta de acceso al servicio que se está definiendo

/*define un nuevo servicio llamado RiskService
  El servicio es un contenedor para las entidades y operaciones que se definen a continuación.*/
service RiskService @(requires: 'authenticated-user') {
  entity Risks @(restrict: [
    {
      grant: 'READ',
      to   : 'RiskViewer'
    },
    {
      grant: [
        'READ',
        'WRITE',
        'UPDATE',
        'UPSERT',
        'DELETE'
      ], // Allowing CDS events by explicitly mentioning them
      to   : 'RiskManager'
    }
  ])                      as projection on rm.Risks;


  annotate Risks with @odata.draft.enabled;


  entity Mitigations @(restrict: [
    {
      grant: 'READ',
      to   : 'RiskViewer'
    },
    {
      grant: '*', // Allow everything using wildcard
      to   : 'RiskManager'
    }
  ])                      as projection on rm.Mitigations;


  annotate Mitigations with @odata.draft.enabled;

  // BusinessPartner
  @readonly entity BusinessPartners as projection on rm.BusinessPartners;
}
