# Checklist del repositorio final

## README principal

- [ ] Explicar problema, objetivos y arquitectura.
- [ ] Incluir diagrama híbrido.
- [ ] Documentar requisitos y ejecución local.
- [ ] Agregar comandos de pruebas y ubicación de resultados.
- [ ] Incluir decisiones CAP y resultados principales.
- [ ] Enlazar informe y presentación exportados.

## Organización

- [ ] Separar claramente PostgreSQL, MongoDB, Unidad 4 y Unidad 6.
- [ ] No versionar volúmenes `pg_data`, `mongo_data` ni `node_modules`.
- [ ] No versionar JTL ni reportes HTML pesados.
- [ ] Versionar CSV consolidados, SVG y resúmenes Markdown.
- [ ] Eliminar `.DS_Store` y archivos temporales.

## Reproducibilidad

- [ ] Verificar `docker compose config`.
- [ ] Ejecutar prueba smoke desde un clon limpio.
- [ ] Documentar puertos y requisitos de memoria/disco.
- [ ] Conservar semillas deterministas.
- [ ] Explicar cómo restaurar el baseline.

## Seguridad

- [ ] Mover credenciales a `.env.example`.
- [ ] Confirmar que `.env` esté ignorado.
- [ ] Usar contraseñas solo de demostración.
- [ ] Revisar historial para evitar secretos.
- [ ] Documentar RBAC y mínimo privilegio.

## Calidad

- [ ] Validar scripts Bash y JavaScript.
- [ ] Ejecutar consultas de validación.
- [ ] Confirmar que diagramas abran correctamente.
- [ ] Revisar ortografía y referencias.
- [ ] Etiquetar una versión final del repositorio.

## Evidencia mínima en Git

- [ ] `consolidado_metricas.csv`.
- [ ] `consolidado_escalabilidad.csv`.
- [ ] Cuatro gráficas SVG.
- [ ] Resumen de resultados.
- [ ] Plan JMeter y scripts de ejecución.
- [ ] Informe y presentación en formato editable y PDF.

