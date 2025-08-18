-- --------------------------------------------------------------------------------
-- Script Final de Creación de Base de Datos Fitosanitaria (v3.0)
-- Plataforma: PostgreSQL (Supabase)
-- Este script crea la estructura completa, incluyendo los módulos de geografía,
-- producción y el sistema de alertas. Es el plano maestro del proyecto.
-- --------------------------------------------------------------------------------

-- PASO 1: Crear los tipos ENUM personalizados
CREATE TYPE tipo_validacion AS ENUM ('PENDIENTE', 'VERIFICADO', 'REFUTADO', 'NO_APLICA', 'HISTORICO_VERIFICADO');
CREATE TYPE modo_diagnostico AS ENUM ('CAMPO', 'CASA', 'PRUEBA');
CREATE TYPE nivel_produccion AS ENUM ('Alto', 'Medio', 'Bajo');

-- PASO 2: Crear las tablas de catálogo y geografía

CREATE TABLE "Categorias" (
  "id_categoria" SERIAL PRIMARY KEY,
  "nombre_categoria" VARCHAR(100) NOT NULL,
  "nombre_subcategoria" VARCHAR(100)
);

CREATE TABLE "Organos_Afectados" (
  "id_organo" SERIAL PRIMARY KEY,
  "nombre_organo" VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE "Referencias" (
  "id_referencia" SERIAL PRIMARY KEY,
  "nombre_fuente" VARCHAR(255),
  "url_referencia" VARCHAR(1024),
  "titulo_publicacion" VARCHAR(512),
  "autores" TEXT,
  "año_publicacion" INTEGER,
  "tipo_fuente" VARCHAR(100),
  "doi" VARCHAR(255),
  "fecha_acceso_nuestro" DATE
);

CREATE TABLE "Taxonomia" (
  "id_taxonomia" SERIAL PRIMARY KEY,
  "reino" VARCHAR(100),
  "phylum" VARCHAR(100),
  "clase" VARCHAR(100),
  "orden" VARCHAR(100),
  "familia" VARCHAR(100),
  "genero" VARCHAR(100),
  "especie" VARCHAR(100)
);

CREATE TABLE "Sintomas" (
  "id_sintoma" SERIAL PRIMARY KEY,
  "descripcion_sintoma" VARCHAR(512) UNIQUE NOT NULL,
  "id_organo_afectado" INT REFERENCES "Organos_Afectados"("id_organo")
);

CREATE TABLE "Metodos_de_Control" (
  "id_control" SERIAL PRIMARY KEY,
  "tipo_control" VARCHAR(50) NOT NULL,
  "descripcion_control" TEXT UNIQUE NOT NULL
);

CREATE TABLE "Paises" (
  "id_pais" SERIAL PRIMARY KEY,
  "nombre_pais" VARCHAR(255) UNIQUE NOT NULL,
  "codigo_iso" VARCHAR(3) UNIQUE
);

CREATE TABLE "Departamentos" (
  "id_depto" SERIAL PRIMARY KEY,
  "nombre_depto" VARCHAR(255) NOT NULL,
  "id_pais" INT NOT NULL REFERENCES "Paises"("id_pais")
);

CREATE TABLE "Municipios" (
  "id_municipio" SERIAL PRIMARY KEY,
  "nombre_municipio" VARCHAR(255) NOT NULL,
  "id_depto" INT NOT NULL REFERENCES "Departamentos"("id_depto")
);

-- PASO 3: Crear las tablas principales y funcionales

CREATE TABLE "Amenazas" (
  "id_amenaza" SERIAL PRIMARY KEY,
  "nombre_comun" VARCHAR(255) NOT NULL,
  "nombre_cientifico" VARCHAR(255),
  "nombre_clave" VARCHAR(512) UNIQUE NOT NULL,
  "descripcion_general" TEXT,
  "impacto_economico" VARCHAR(50),
  "distribucion_global" TEXT,
  "id_categoria" INT REFERENCES "Categorias"("id_categoria"),
  "id_taxonomia" INT UNIQUE REFERENCES "Taxonomia"("id_taxonomia")
);

CREATE TABLE "Usuarios" (
  "id_usuario" SERIAL PRIMARY KEY,
  "nombre_completo" VARCHAR(255),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password_hash" VARCHAR(255),
  "rol" VARCHAR(50),
  "fecha_registro" TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "Imagenes" (
  "id_imagen" SERIAL PRIMARY KEY,
  "path_almacenamiento" VARCHAR(1024) NOT NULL,
  "descripcion_imagen" TEXT,
  "id_usuario_subida" INT REFERENCES "Usuarios"("id_usuario")
);

CREATE TABLE "Detecciones_Campo" (
  "id_deteccion" SERIAL PRIMARY KEY,
  "id_usuario" INT NOT NULL REFERENCES "Usuarios"("id_usuario"),
  "id_amenaza_detectada" INT NOT NULL REFERENCES "Amenazas"("id_amenaza"),
  "id_municipio" INT REFERENCES "Municipios"("id_municipio"),
  "latitud" DECIMAL(10, 8),
  "longitud" DECIMAL(11, 8),
  "precision_gps" REAL,
  "fecha_hora_scan" TIMESTAMPTZ DEFAULT now(),
  "id_imagen_scan" INT UNIQUE REFERENCES "Imagenes"("id_imagen"),
  "confianza_ia" REAL,
  "modo_diagnostico" modo_diagnostico,
  "estado_validacion" tipo_validacion,
  "id_verificador" INT REFERENCES "Usuarios"("id_usuario"),
  "notas_usuario" TEXT
);

CREATE TABLE "Parcelas" (
  "id_parcela" SERIAL PRIMARY KEY,
  "id_usuario" INT NOT NULL REFERENCES "Usuarios"("id_usuario"),
  "nombre_parcela" VARCHAR(255),
  "area_hectareas" REAL,
  -- PostGIS gestionará la geometría. Por ahora creamos la tabla.
  "notas" TEXT
);

CREATE TABLE "Vuelos_Dron" (
  "id_vuelo" SERIAL PRIMARY KEY,
  "id_parcela" INT NOT NULL REFERENCES "Parcelas"("id_parcela"),
  "fecha_hora_vuelo" TIMESTAMPTZ,
  "tipo_sensor" VARCHAR(100),
  "id_mapa_procesado" INT REFERENCES "Imagenes"("id_imagen")
);

CREATE TABLE "Alertas_Mapa" (
  "id_alerta" SERIAL PRIMARY KEY,
  "id_vuelo" INT NOT NULL REFERENCES "Vuelos_Dron"("id_vuelo"),
  "id_amenaza_inferida" INT REFERENCES "Amenazas"("id_amenaza"),
  "latitud_foco" DECIMAL(10, 8),
  "longitud_foco" DECIMAL(11, 8),
  "severidad_estimada" VARCHAR(50),
  "estado_alerta" VARCHAR(50),
  "id_tecnico_asignado" INT REFERENCES "Usuarios"("id_usuario")
);

CREATE TABLE "Produccion_Departamental" (
  "id_produccion" SERIAL PRIMARY KEY,
  "id_depto" INT NOT NULL REFERENCES "Departamentos"("id_depto"),
  "cultivo" VARCHAR(100),
  "nivel_produccion" nivel_produccion,
  "fuente_dato" VARCHAR(100),
  "año_dato" INT
);

CREATE TABLE "Notificaciones" (
  "id_notificacion" SERIAL PRIMARY KEY,
  "id_usuario_receptor" INT NOT NULL REFERENCES "Usuarios"("id_usuario"),
  "id_deteccion_origen" INT REFERENCES "Detecciones_Campo"("id_deteccion"),
  "mensaje_alerta" TEXT,
  "fecha_envio" TIMESTAMPTZ DEFAULT now(),
  "estado_leido" BOOLEAN DEFAULT false
);

-- PASO 4: Crear las tablas de conexión (Muchos a Muchos)

CREATE TABLE "Amenaza_Sintoma" (
  "id_amenaza" INT NOT NULL REFERENCES "Amenazas"("id_amenaza"),
  "id_sintoma" INT NOT NULL REFERENCES "Sintomas"("id_sintoma"),
  PRIMARY KEY ("id_amenaza", "id_sintoma")
);

CREATE TABLE "Amenaza_Control" (
  "id_amenaza" INT NOT NULL REFERENCES "Amenazas"("id_amenaza"),
  "id_control" INT NOT NULL REFERENCES "Metodos_de_Control"("id_control"),
  PRIMARY KEY ("id_amenaza", "id_control")
);

CREATE TABLE "Amenaza_Referencia" (
  "id_amenaza" INT NOT NULL REFERENCES "Amenazas"("id_amenaza"),
  "id_referencia" INT NOT NULL REFERENCES "Referencias"("id_referencia"),
  PRIMARY KEY ("id_amenaza", "id_referencia")
);

CREATE TABLE "Amenaza_Imagen_Referencia" (
  "id_amenaza" INT NOT NULL REFERENCES "Amenazas"("id_amenaza"),
  "id_imagen" INT NOT NULL REFERENCES "Imagenes"("id_imagen"),
  PRIMARY KEY ("id_amenaza", "id_imagen")
);

-- --------------------------------------------------------------------------------
-- FIN DEL SCRIPT DE CREACIÓN
-- --------------------------------------------------------------------------------
