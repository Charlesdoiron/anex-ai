{
"name": "compute_lease_rent_schedule",
"description": "Calcule un plan de loyers (bureaux, parkings, charges, taxes) pour un bail commercial indexé.",
"parameters": {
"type": "object",
"properties": {
"start_date": { "type": "string", "format": "date" },
"end_date": { "type": "string", "format": "date" },

      "payment_frequency": {
        "type": "string",
        "enum": ["monthly", "quarterly"]
      },

      "base_index_value": { "type": "number" },

      "known_index_points": {
        "type": "array",
        "description": "Liste d'indices connus (INSEE) utilisés pour l'indexation.",
        "items": {
          "type": "object",
          "properties": {
            "effective_date": { "type": "string", "format": "date" },
            "index_value": { "type": "number" }
          },
          "required": ["effective_date", "index_value"]
        }
      },

      "charges_growth_rate": {
        "type": "number",
        "description": "Hausse annuelle des charges et taxes (ex 0.02 pour 2%)"
      },

      "office_rent_ht": { "type": "number" },
      "parking_rent_ht": { "type": "number" },
      "charges_ht": { "type": "number" },
      "taxes_ht": { "type": "number" },
      "other_costs_ht": { "type": "number" },

      "deposit_months": { "type": "integer" },
      "franchise_months": { "type": "integer" },

      "incentive_amount": {
        "type": "number",
        "description": "Montant des travaux ou contributions du bailleur (négatif dans le loyer net)."
      },

      "horizon_years": {
        "type": "integer",
        "description": "Nombre d'années à calculer à partir du début du bail",
        "default": 3
      }
    },
    "required": [
      "start_date",
      "end_date",
      "payment_frequency",
      "base_index_value",
      "office_rent_ht"
    ]

}
}
