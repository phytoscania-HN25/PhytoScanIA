# 📊 Base de Datos – PhytoScan IA

Este documento describe la arquitectura y las tablas principales de la base de datos del proyecto, gestionada en Supabase (PostgreSQL).

---

## Tablas Principales

A continuación se detallan las tablas que forman el núcleo de la aplicación.

### 1. usuarios
Almacena la información de todos los usuarios registrados en la plataforma.
- `id` integer PK
- `auth_user_id` uuid FK → auth.users.id
- `nombre_completo` varchar
- `email` varchar (UNIQUE)
- `rol` varchar (productor, técnico, etc.)
- `fecha_registro` timestamptz

### 2. amenazas
Es el catálogo maestro de todas las plagas y enfermedades.
- `id` integer PK
- `nombre_comun` varchar
- `nombre_cientifico` varchar
- `descripcion_general` text
- `categoria_id` integer FK → categorias.id
- `taxonomia_id` integer FK → taxonomia.id

### 3. detecciones_campo
Registra cada diagnóstico realizado por un usuario. Es la tabla transaccional más importante.
- `id` integer PK
- `usuario_id` integer FK → usuarios.id
- `amenaza_detectada_id` integer FK → amenazas.id
- `imagen_scan_id` integer FK → imagenes.id
- `parcela_id` integer FK → parcelas.id
- `ubicacion` point (latitud, longitud)
- `fecha_hora_scan` timestamptz
- `confianza_ia` real
- `estado_validacion` enum (PENDIENTE, VALIDADO, RECHAZADO)

### 4. imagenes
Gestiona todas las imágenes subidas por los usuarios.
- `id` integer PK
- `path_almacenamiento` varchar (URL en Supabase Storage)
- `usuario_subida_id` integer FK → usuarios.id
- `descripcion` text

### 5. parcelas
Define las fincas o áreas geográficas pertenecientes a un usuario.
- `id` integer PK
- `usuario_id` integer FK → usuarios.id
- `nombre_parcela` varchar
- `area_hectareas` numeric
- `geometria_poligono` json

### 6. phytobot_consultas
Guarda el historial de conversaciones con el asistente virtual.
- `id` integer PK
- `id_usuario` integer FK → usuarios.id
- `pregunta_usuario` text
- `respuesta_bot` text
- `fecha_hora` timestamptz

---

## Relaciones Principales
- Un `usuario` puede tener muchas `detecciones_campo`, `parcelas` y `phytobot_consultas`.
- Una `deteccion_campo` pertenece a un solo `usuario`, una `amenaza`, una `imagen` y una `parcela`.
- Una `amenaza` puede estar presente en muchas `detecciones_campo`.

---

## Diagrama ER (Mermaid)

```mermaid
erDiagram
    usuarios {
        int id PK
        uuid auth_user_id FK
        varchar nombre_completo
        varchar email
    }
    amenazas {
        int id PK
        varchar nombre_comun
        varchar nombre_cientifico
    }
    detecciones_campo {
        int id PK
        int usuario_id FK
        int amenaza_detectada_id FK
        int imagen_scan_id FK
        point ubicacion
    }
    imagenes {
        int id PK
        varchar path_almacenamiento
        int usuario_subida_id FK
    }
    parcelas {
        int id PK
        int usuario_id FK
        varchar nombre_parcela
    }

    usuarios ||--o{ detecciones_campo : "realiza"
    usuarios ||--o{ parcelas : "posee"
    amenazas ||--o{ detecciones_campo : "es_identificada_en"
    imagenes ||--o{ detecciones_campo : "es_evidencia_de"
    parcelas ||--o{ detecciones_campo : "ocurre_en"