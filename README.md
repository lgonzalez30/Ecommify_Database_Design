# Ecommify — Diseño de Base de Datos Híbrida

**Proyecto Integrador: Diseño y Optimización de Bases de Datos** **Maestría en Arquitectura de Software — Universidad de La Sabana** **Profesor:** Miguel Alfonso Varela Fonseca

## Equipo de Trabajo

- Andrés Fernando Diaz Moreno
- Carlos Alberto Arévalo Martínez
- Luis Alfredo Gonzalez Mercado
- Andrés Camilo Lopez Castro

---

## 1. Descripción del Proyecto

Este repositorio contiene el diseño conceptual, lógico y físico de la base de datos para **Ecommify**, una plataforma de comercio electrónico multivendedor (marketplace). El modelo de datos ha sido diseñado utilizando como línea base el dataset empírico **Brazilian E-Commerce by Olist**.

El proyecto resuelve la tensión entre el procesamiento transaccional seguro (OLTP) y la alta disponibilidad para lecturas masivas y analítica (OLAP) mediante la implementación de una arquitectura políglota.

## 2. Decisiones Arquitectónicas

La solución adopta una **Arquitectura Políglota Híbrida** estructurada en dos motores complementarios:

* **PostgreSQL (Fuente de Verdad / OLTP):** Gestiona el núcleo transaccional del negocio (órdenes, pagos, inventario, clientes). Garantiza consistencia estricta (ACID). Para evitar la dispersión de motores, exprime las capacidades avanzadas nativas de PostgreSQL:
    * `JSONB` para especificaciones dinámicas del catálogo.
    * `ARRAY` y Composite Types para atributos estructurados múltiples.
    * `TSTZRANGE` para validación temporal nativa de promociones.
    * Extensiones: `PostGIS` (análisis espacial de envíos), `pg_trgm` (búsqueda difusa) y particionamiento nativo (`hot/cold data`) para la tabla de órdenes.
* **MongoDB (Proyección y NoSQL / OLAP):** Actúa como motor optimizado para lectura y alta disponibilidad (Teorema CAP: prioriza AP).
    * Almacena una proyección denormalizada del catálogo de productos (Patrón *Extended Reference* y *Computed*).
    * Gestiona el almacenamiento primario de datos con esquemas flexibles y alto volumen de escritura: reseñas (Patrón *Polymorphic*), analítica de eventos (Patrón *Bucket*) y sesiones de usuario (Índices *TTL*).

---

## 3. Estructura del Repositorio y Entregables

La jerarquía del código refleja la separación de responsabilidades de la arquitectura. **Para la revisión académica, se sugiere iniciar por la carpeta `docs/`**.

```text
Ecommify_Database_Design/
├── docs/                                  # Entregables formales de la asignatura
│   ├── Documento_Tecnico_Diseno.pdf       # Especificación arquitectónica y diseño ER (Normas APA 7)
│   └── Presentacion_Ejecutiva.pdf         # Síntesis directiva del proyecto
├── mongodb/
│   ├── README.md                          # Guia de prueba local MongoDB
│   ├── init/
│   │   └── 01_init_collections.js         # Validadores, indices y datos mock
│   ├── queries/
│   │   └── validation_queries.js          # Pruebas de conexion, indices y consultas
│   └── schema/                            # Módulo NoSQL
│       ├── analytics_events.json          # Esquema de eventos (Bucket Pattern)
│       ├── collections.md                 # Documentación de colecciones y patrones
│       ├── product_catalog.json           # Proyección de lectura (Extended Reference)
│       ├── reviews.json                   # Esquema de reseñas (Polymorphic Pattern)
│       └── user_sessions.json             # Esquema de sesiones efímeras (TTL)
├── notebooks/
│   └── Data_Exploration_Analysis.ipynb    # Análisis Exploratorio de Datos (EDA) del dataset Olist
├── mongo_data/                            # Volumen local MongoDB (ignorado en Git)
├── pg_data/                               # Volumen local de Docker (Ignorado en Git)
├── postgresql/                            # Módulo Relacional Avanzado
│   ├── queries/
│   │   └── ejemplos_consultas.sql         # Pruebas de validación (JSONB, PostGIS, particiones)
│   ├── schema/                            # Orquestación DDL automatizada (00 a 08)
│   │   ├── 00_extensions.sql              # Habilitación de PostGIS, pg_trgm, etc.
│   │   ├── 01_types.sql                   # Tipos compuestos y ENUMs
│   │   ├── 02_tables.sql                  # Tablas normalizadas en 3FN
│   │   ├── 03_partitions.sql              # Particionamiento de órdenes
│   │   ├── 04_indexes.sql                 # Índices GIN, GiST y B-Tree
│   │   ├── 05_constraints.sql             # Reglas de integridad y chequeos
│   │   ├── 06_triggers.sql                # Automatización de auditoría y fechas
│   │   ├── 07_5_mock_data.sql             # Datos de prueba controlados
│   │   ├── 07_materialized_views.sql      # Vistas para reportería OLAP
│   │   └── 08_roles_permissions.sql       # Implementación RBAC (OLTP vs Analítica)
├── .gitignore
├── docker-compose.yml                     # Definición de infraestructura local
└── README.md
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
9. `mongodb/README.md` — prueba local de MongoDB con Docker.
10. `docs/03_decisiones_arquitectonicas.md` — cómo conviven los dos motores.
11. `docs/04_matriz_decision.md` — justificación de qué entidad va a qué motor.

## Estado del entregable

El repositorio incluye los componentes solicitados para la Etapa 2:

- Documento técnico de diseño en formato editable: `docs/Documento_Tecnico_Diseno.docx`.
- Presentación ejecutiva en formato editable: `docs/Presentacion_Ejecutiva.pptx`.
- Diagramas ER y arquitectura híbrida en `.drawio` y `.png`.
- Scripts DDL preliminares de PostgreSQL en `postgresql/schema/`.
- Consultas de ejemplo en `postgresql/queries/`.
- Esquemas y ejemplos de documentos MongoDB en `mongodb/schema/`.
- Inicializacion local de MongoDB con validadores, indices y datos mock en `mongodb/init/`.
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
