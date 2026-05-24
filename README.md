# Ecommify Database Design

**Proyecto integrador — Diseño y Optimización de Bases de Datos**
**Maestría en Arquitectura de Software — Universidad de La Sabana**
**Profesor:** Miguel Alfonso Varela Fonseca

## Equipo

- Andrés Fernando Diaz Moreno
- Carlos Alberto Arévalo Martínez
- Luis Alfredo Gonzalez Mercado
- Andrés Camilo Lopez Castro

## Sobre este repositorio

Este repositorio contiene el diseño conceptual y lógico de la base de datos híbrida (PostgreSQL + MongoDB) para Ecommify, una plataforma de comercio electrónico multivendedor. El diseño consolida el trabajo de las Unidades 1 y 2 de la materia e incluye los insumos técnicos, diagramas, scripts preliminares, documento técnico y presentación ejecutiva.

El dataset de referencia es **Brazilian E-Commerce by Olist** ([Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)).

## Enfoque arquitectónico

Arquitectura Políglota Híbrida (heredada de la decisión de Unidad 1):

- **PostgreSQL** como núcleo transaccional y analítico: customers, orders, order_items, payments, products (con tipos avanzados nativos), sellers, categories, promotions, reviews indirectamente vinculadas. Incluye particionamiento de `orders`, materialized views para reporting, y extensiones PostGIS, pg_trgm y pgcrypto.
- **MongoDB** complementario: proyección de lectura del catálogo enriquecido, storage de reviews, logs de comportamiento de usuarios y sesiones efímeras.

## Cómo navegar el repositorio

```
Ecommify_Database_Design/
├── README.md                                  ← estás aquí
├── docs/
│   ├── Documento_Tecnico_Diseno.docx          ← documento técnico final editable
│   ├── Presentacion_Ejecutiva.pptx            ← presentación ejecutiva editable
│   ├── 00_borrador_documento_tecnico.md       ← insumo fuente del documento técnico
│   ├── 01_analisis_requisitos.md              ← requisitos funcionales y no funcionales
│   ├── 02_descripcion_entidades.md            ← entidades, atributos, relaciones, cardinalidades
│   ├── 03_decisiones_arquitectonicas.md       ← arquitectura híbrida y flujos de sincronización
│   ├── 04_matriz_decision.md                  ← matriz PostgreSQL vs MongoDB + análisis CAP
│   └── diagrams/
│       ├── ER_Ecommify.drawio                 ← diagrama ER editable
│       ├── ER_Ecommify.png                    ← diagrama ER exportado
│       ├── arquitectura_hibrida.drawio        ← diagrama de arquitectura editable
│       └── arquitectura_hibrida.png           ← diagrama de arquitectura exportado
├── postgresql/
│   ├── schema/                                ← scripts DDL numerados (orden de ejecución)
│   │   ├── 00_extensions.sql
│   │   ├── 01_types.sql
│   │   ├── 02_tables.sql
│   │   ├── 03_partitions.sql
│   │   ├── 04_indexes.sql
│   │   ├── 05_constraints.sql
│   │   ├── 06_triggers.sql
│   │   └── 07_materialized_views.sql
│   ├── seed_data/
│   │   └── README.md                          ← instrucciones para poblar desde Olist
│   └── queries/
│       └── ejemplos_consultas.sql             ← consultas que aprovechan tipos avanzados
├── mongodb/
│   └── schema/
│       ├── collections.md                     ← descripción de colecciones y patrones
│       ├── product_catalog.json               ← ejemplo de documento (proyección de catálogo)
│       ├── reviews.json                       ← ejemplo de documento
│       ├── analytics_events.json              ← ejemplo de documento
│       └── user_sessions.json                 ← ejemplo de documento (con TTL)
└── notebooks/
    └── Data_Exploration_Analysis.ipynb        ← EDA enriquecido del dataset Olist
```

## Orden de lectura sugerido

1. `docs/Documento_Tecnico_Diseno.docx` — documento técnico consolidado.
2. `docs/Presentacion_Ejecutiva.pptx` — resumen ejecutivo para socialización.
3. `notebooks/Data_Exploration_Analysis.ipynb` — análisis exploratorio del dataset.
4. `docs/01_analisis_requisitos.md` — requisitos funcionales y no funcionales.
5. `docs/diagrams/ER_Ecommify.png` — modelo conceptual visual.
6. `docs/02_descripcion_entidades.md` — detalle por entidad.
7. `postgresql/schema/` — scripts DDL en orden numérico.
8. `mongodb/schema/collections.md` — diseño de colecciones.
9. `docs/03_decisiones_arquitectonicas.md` — cómo conviven los dos motores.
10. `docs/04_matriz_decision.md` — justificación de qué entidad va a qué motor.

## Estado del entregable

El repositorio incluye los componentes solicitados para la Etapa 2:

- Documento técnico de diseño en formato editable: `docs/Documento_Tecnico_Diseno.docx`.
- Presentación ejecutiva en formato editable: `docs/Presentacion_Ejecutiva.pptx`.
- Diagramas ER y arquitectura híbrida en `.drawio` y `.png`.
- Scripts DDL preliminares de PostgreSQL en `postgresql/schema/`.
- Consultas de ejemplo en `postgresql/queries/`.
- Esquemas y ejemplos de documentos MongoDB en `mongodb/schema/`.
- Notebook de análisis exploratorio del dataset Olist en `notebooks/`.

Para la entrega formal en plataforma académica, exportar los archivos editables a:

- `docs/Documento_Tecnico_Diseno.pdf`
- `docs/Presentacion_Ejecutiva.pdf`

## Referencias

- PostgreSQL Global Development Group. (2025). *Data types*. PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/datatype.html
- PostgreSQL Global Development Group. (2025). *Server programming: Extending SQL*. PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/extend.html
- PostgreSQL Global Development Group. (2025). *Database design*. PostgreSQL 16 Documentation. https://www.postgresql.org/docs/16/ddl.html
- MongoDB, Inc. (2025). *Data modeling introduction*. MongoDB Manual. https://www.mongodb.com/docs/manual/core/data-modeling-introduction/
- Bradshaw, S., Brazil, E., & Chodorow, K. (2019). *MongoDB: The definitive guide* (3rd ed.). O'Reilly Media.
