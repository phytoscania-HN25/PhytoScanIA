-- --------------------------------------------------------------------------------
-- Script Final de Creación de Base de Datos Fitosanitaria (v3.0)
-- Plataforma: PostgreSQL (Supabase)
-- Este script crea la estructura completa, incluyendo los módulos de geografía,
-- producción y el sistema de alertas. Es el plano maestro del proyecto.
-- --------------------------------------------------------------------------------

CREATE TABLE public.Alertas_Mapa (
  id_alerta integer NOT NULL DEFAULT nextval('"Alertas_Mapa_id_alerta_seq"'::regclass),
  id_vuelo integer NOT NULL,
  id_amenaza_inferida integer,
  coordenadas_foco json NOT NULL,
  severidad_estimada real,
  estado_alerta USER-DEFINED NOT NULL DEFAULT 'NUEVA'::estado_alerta_enum,
  id_tecnico_asignado integer,
  CONSTRAINT Alertas_Mapa_pkey PRIMARY KEY (id_alerta),
  CONSTRAINT Alertas_Mapa_id_vuelo_fkey FOREIGN KEY (id_vuelo) REFERENCES public.Vuelos_Dron(id_vuelo),
  CONSTRAINT Alertas_Mapa_id_amenaza_inferida_fkey FOREIGN KEY (id_amenaza_inferida) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Alertas_Mapa_id_tecnico_asignado_fkey FOREIGN KEY (id_tecnico_asignado) REFERENCES public.Usuarios(id_usuario)
);
CREATE TABLE public.Amenaza_Control (
  id_amenaza integer NOT NULL,
  id_control integer NOT NULL,
  CONSTRAINT Amenaza_Control_pkey PRIMARY KEY (id_control, id_amenaza),
  CONSTRAINT Amenaza_Control_id_amenaza_fkey FOREIGN KEY (id_amenaza) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Amenaza_Control_id_control_fkey FOREIGN KEY (id_control) REFERENCES public.Metodos_de_Control(id_control)
);
CREATE TABLE public.Amenaza_Imagen_Referencia (
  id_amenaza integer NOT NULL,
  id_imagen integer NOT NULL,
  CONSTRAINT Amenaza_Imagen_Referencia_pkey PRIMARY KEY (id_amenaza, id_imagen),
  CONSTRAINT Amenaza_Imagen_Referencia_id_amenaza_fkey FOREIGN KEY (id_amenaza) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Amenaza_Imagen_Referencia_id_imagen_fkey FOREIGN KEY (id_imagen) REFERENCES public.Imagenes(id_imagen)
);
CREATE TABLE public.Amenaza_Referencia (
  id_amenaza integer NOT NULL,
  id_referencia integer NOT NULL,
  CONSTRAINT Amenaza_Referencia_pkey PRIMARY KEY (id_referencia, id_amenaza),
  CONSTRAINT Amenaza_Referencia_id_amenaza_fkey FOREIGN KEY (id_amenaza) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Amenaza_Referencia_id_referencia_fkey FOREIGN KEY (id_referencia) REFERENCES public.Referencias(id_referencia)
);
CREATE TABLE public.Amenaza_Sintoma (
  id_amenaza integer NOT NULL,
  id_sintoma integer NOT NULL,
  CONSTRAINT Amenaza_Sintoma_pkey PRIMARY KEY (id_amenaza, id_sintoma),
  CONSTRAINT Amenaza_Sintoma_id_amenaza_fkey FOREIGN KEY (id_amenaza) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Amenaza_Sintoma_id_sintoma_fkey FOREIGN KEY (id_sintoma) REFERENCES public.Sintomas(id_sintoma)
);
CREATE TABLE public.Amenazas (
  id_amenaza integer NOT NULL DEFAULT nextval('"Amenazas_id_amenaza_seq"'::regclass),
  nombre_comun character varying NOT NULL,
  nombre_cientifico character varying,
  nombre_clave character varying UNIQUE,
  descripcion_general text,
  impacto_economico character varying,
  distribucion_global text,
  id_categoria integer,
  id_taxonomia integer,
  CONSTRAINT Amenazas_pkey PRIMARY KEY (id_amenaza),
  CONSTRAINT Amenazas_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.Categorias(id_categoria),
  CONSTRAINT Amenazas_id_taxonomia_fkey FOREIGN KEY (id_taxonomia) REFERENCES public.Taxonomia(id_taxonomia)
);
CREATE TABLE public.Categorias (
  id_categoria integer NOT NULL DEFAULT nextval('"Categorias_id_categoria_seq"'::regclass),
  nombre_categoria character varying NOT NULL,
  nombre_subcategoria character varying,
  CONSTRAINT Categorias_pkey PRIMARY KEY (id_categoria)
);
CREATE TABLE public.Departamentos (
  id_depto integer NOT NULL DEFAULT nextval('"Departamentos_id_depto_seq"'::regclass),
  nombre_depto character varying NOT NULL,
  id_pais integer NOT NULL,
  CONSTRAINT Departamentos_pkey PRIMARY KEY (id_depto),
  CONSTRAINT Departamentos_id_pais_fkey FOREIGN KEY (id_pais) REFERENCES public.Paises(id_pais)
);
CREATE TABLE public.Detecciones_Campo (
  id_deteccion integer NOT NULL DEFAULT nextval('"Detecciones_Campo_id_deteccion_seq"'::regclass),
  id_usuario integer NOT NULL,
  id_amenaza_detectada integer NOT NULL,
  latitud numeric NOT NULL,
  longitud numeric NOT NULL,
  precision_gps real,
  fecha_hora_scan timestamp with time zone NOT NULL DEFAULT now(),
  id_imagen_scan integer NOT NULL,
  confianza_ia real,
  modo_diagnostico USER-DEFINED NOT NULL,
  estado_validacion USER-DEFINED NOT NULL DEFAULT 'PENDIENTE'::estado_validacion_enum,
  id_verificador integer,
  notas_usuario text,
  id_municipio integer,
  id_parcela integer,
  CONSTRAINT Detecciones_Campo_pkey PRIMARY KEY (id_deteccion),
  CONSTRAINT Detecciones_Campo_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.Usuarios(id_usuario),
  CONSTRAINT Detecciones_Campo_id_amenaza_detectada_fkey FOREIGN KEY (id_amenaza_detectada) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Detecciones_Campo_id_imagen_scan_fkey FOREIGN KEY (id_imagen_scan) REFERENCES public.Imagenes(id_imagen),
  CONSTRAINT Detecciones_Campo_id_verificador_fkey FOREIGN KEY (id_verificador) REFERENCES public.Usuarios(id_usuario),
  CONSTRAINT Detecciones_Campo_id_municipio_fkey FOREIGN KEY (id_municipio) REFERENCES public.Municipios(id_municipio),
  CONSTRAINT Detecciones_Campo_id_parcela_fkey FOREIGN KEY (id_parcela) REFERENCES public.Parcelas(id_parcela)
);
CREATE TABLE public.Imagenes (
  id_imagen integer NOT NULL DEFAULT nextval('"Imagenes_id_imagen_seq"'::regclass),
  path_almacenamiento character varying NOT NULL,
  descripcion_imagen text,
  id_usuario_subida integer,
  CONSTRAINT Imagenes_pkey PRIMARY KEY (id_imagen),
  CONSTRAINT Imagenes_id_usuario_subida_fkey FOREIGN KEY (id_usuario_subida) REFERENCES public.Usuarios(id_usuario)
);
CREATE TABLE public.Metodos_de_Control (
  id_control integer NOT NULL DEFAULT nextval('"Metodos_de_Control_id_control_seq"'::regclass),
  tipo_control character varying NOT NULL,
  descripcion_control text NOT NULL,
  CONSTRAINT Metodos_de_Control_pkey PRIMARY KEY (id_control)
);
CREATE TABLE public.Muestras_Laboratorio (
  id_muestra integer NOT NULL DEFAULT nextval('"Muestras_Laboratorio_id_muestra_seq"'::regclass),
  id_deteccion integer NOT NULL UNIQUE,
  codigo_muestra character varying NOT NULL UNIQUE,
  fecha_envio date,
  laboratorio_destino character varying,
  fecha_recepcion_lab date,
  resultado_analisis text,
  id_amenaza_confirmada integer,
  fecha_resultado date,
  id_tecnico_responsable integer,
  CONSTRAINT Muestras_Laboratorio_pkey PRIMARY KEY (id_muestra),
  CONSTRAINT Muestras_Laboratorio_id_deteccion_fkey FOREIGN KEY (id_deteccion) REFERENCES public.Detecciones_Campo(id_deteccion),
  CONSTRAINT Muestras_Laboratorio_id_amenaza_confirmada_fkey FOREIGN KEY (id_amenaza_confirmada) REFERENCES public.Amenazas(id_amenaza),
  CONSTRAINT Muestras_Laboratorio_id_tecnico_responsable_fkey FOREIGN KEY (id_tecnico_responsable) REFERENCES public.Usuarios(id_usuario)
);
CREATE TABLE public.Municipios (
  id_municipio integer NOT NULL DEFAULT nextval('"Municipios_id_municipio_seq"'::regclass),
  nombre_municipio character varying NOT NULL,
  id_depto integer NOT NULL,
  CONSTRAINT Municipios_pkey PRIMARY KEY (id_municipio),
  CONSTRAINT Municipios_id_depto_fkey FOREIGN KEY (id_depto) REFERENCES public.Departamentos(id_depto)
);
CREATE TABLE public.Notificaciones (
  id_notificacion integer NOT NULL DEFAULT nextval('"Notificaciones_id_notificacion_seq"'::regclass),
  id_usuario_receptor integer NOT NULL,
  id_deteccion_origen integer,
  mensaje_alerta text,
  fecha_envio timestamp with time zone DEFAULT now(),
  estado_leido boolean DEFAULT false,
  CONSTRAINT Notificaciones_pkey PRIMARY KEY (id_notificacion),
  CONSTRAINT Notificaciones_id_usuario_receptor_fkey FOREIGN KEY (id_usuario_receptor) REFERENCES public.Usuarios(id_usuario),
  CONSTRAINT Notificaciones_id_deteccion_origen_fkey FOREIGN KEY (id_deteccion_origen) REFERENCES public.Detecciones_Campo(id_deteccion)
);
CREATE TABLE public.Organos_Afectados (
  id_organo integer NOT NULL DEFAULT nextval('"Organos_Afectados_id_organo_seq"'::regclass),
  nombre_organo character varying NOT NULL UNIQUE,
  CONSTRAINT Organos_Afectados_pkey PRIMARY KEY (id_organo)
);
CREATE TABLE public.Paises (
  id_pais integer NOT NULL DEFAULT nextval('"Paises_id_pais_seq"'::regclass),
  nombre_pais character varying NOT NULL UNIQUE,
  codigo_iso character varying UNIQUE,
  CONSTRAINT Paises_pkey PRIMARY KEY (id_pais)
);
CREATE TABLE public.Parcelas (
  id_parcela integer NOT NULL DEFAULT nextval('"Parcelas_id_parcela_seq"'::regclass),
  id_usuario integer NOT NULL,
  nombre_parcela character varying NOT NULL,
  ubicacion_centro json,
  area_hectareas numeric,
  geometria_poligono json,
  CONSTRAINT Parcelas_pkey PRIMARY KEY (id_parcela),
  CONSTRAINT Parcelas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.Usuarios(id_usuario)
);
CREATE TABLE public.Phytobot_Consultas (
  id_consulta integer NOT NULL DEFAULT nextval('"Phytobot_Consultas_id_consulta_seq"'::regclass),
  id_usuario integer NOT NULL,
  pregunta_usuario text NOT NULL,
  respuesta_bot text,
  id_amenaza_inferida integer,
  fecha_hora timestamp with time zone NOT NULL DEFAULT now(),
  feedback_usuario integer,
  CONSTRAINT Phytobot_Consultas_pkey PRIMARY KEY (id_consulta),
  CONSTRAINT Phytobot_Consultas_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.Usuarios(id_usuario),
  CONSTRAINT Phytobot_Consultas_id_amenaza_inferida_fkey FOREIGN KEY (id_amenaza_inferida) REFERENCES public.Amenazas(id_amenaza)
);
CREATE TABLE public.Produccion_Departamental (
  id_produccion integer NOT NULL DEFAULT nextval('"Produccion_Departamental_id_produccion_seq"'::regclass),
  id_depto integer NOT NULL,
  cultivo character varying,
  nivel_produccion USER-DEFINED,
  fuente_dato character varying,
  año_dato integer,
  CONSTRAINT Produccion_Departamental_pkey PRIMARY KEY (id_produccion),
  CONSTRAINT Produccion_Departamental_id_depto_fkey FOREIGN KEY (id_depto) REFERENCES public.Departamentos(id_depto)
);
CREATE TABLE public.Referencias (
  id_referencia integer NOT NULL DEFAULT nextval('"Referencias_id_referencia_seq"'::regclass),
  nombre_fuente character varying NOT NULL,
  url_referencia character varying,
  titulo_publicacion character varying,
  autores text,
  año_publicacion integer,
  tipo_fuente character varying,
  doi character varying,
  fecha_acceso_nuestro date,
  CONSTRAINT Referencias_pkey PRIMARY KEY (id_referencia)
);
CREATE TABLE public.Sintomas (
  id_sintoma integer NOT NULL DEFAULT nextval('"Sintomas_id_sintoma_seq"'::regclass),
  descripcion_sintoma text NOT NULL,
  id_organo_afectado integer,
  CONSTRAINT Sintomas_pkey PRIMARY KEY (id_sintoma),
  CONSTRAINT Sintomas_id_organo_afectado_fkey FOREIGN KEY (id_organo_afectado) REFERENCES public.Organos_Afectados(id_organo)
);
CREATE TABLE public.Taxonomia (
  id_taxonomia integer NOT NULL DEFAULT nextval('"Taxonomia_id_taxonomia_seq"'::regclass),
  reino character varying,
  phylum character varying,
  clase character varying,
  orden character varying,
  familia character varying,
  genero character varying,
  especie character varying,
  CONSTRAINT Taxonomia_pkey PRIMARY KEY (id_taxonomia)
);
CREATE TABLE public.Tratamientos_Aplicados (
  id_tratamiento integer NOT NULL DEFAULT nextval('"Tratamientos_Aplicados_id_tratamiento_seq"'::regclass),
  id_deteccion integer,
  id_parcela integer NOT NULL,
  id_control integer NOT NULL,
  fecha_aplicacion date NOT NULL,
  id_usuario_aplicador integer NOT NULL,
  dosis_aplicada character varying,
  efectividad_observada text,
  costo_tratamiento numeric,
  notas text,
  CONSTRAINT Tratamientos_Aplicados_pkey PRIMARY KEY (id_tratamiento),
  CONSTRAINT Tratamientos_Aplicados_id_deteccion_fkey FOREIGN KEY (id_deteccion) REFERENCES public.Detecciones_Campo(id_deteccion),
  CONSTRAINT Tratamientos_Aplicados_id_parcela_fkey FOREIGN KEY (id_parcela) REFERENCES public.Parcelas(id_parcela),
  CONSTRAINT Tratamientos_Aplicados_id_control_fkey FOREIGN KEY (id_control) REFERENCES public.Metodos_de_Control(id_control),
  CONSTRAINT Tratamientos_Aplicados_id_usuario_aplicador_fkey FOREIGN KEY (id_usuario_aplicador) REFERENCES public.Usuarios(id_usuario)
);
CREATE TABLE public.Usuarios (
  id_usuario integer NOT NULL DEFAULT nextval('"Usuarios_id_usuario_seq"'::regclass),
  nombre_completo character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying,
  rol character varying NOT NULL,
  fecha_registro timestamp with time zone NOT NULL DEFAULT now(),
  auth_user_id uuid UNIQUE,
  CONSTRAINT Usuarios_pkey PRIMARY KEY (id_usuario)
);
CREATE TABLE public.Vuelos_Dron (
  id_vuelo integer NOT NULL DEFAULT nextval('"Vuelos_Dron_id_vuelo_seq"'::regclass),
  id_parcela integer NOT NULL,
  fecha_hora_vuelo timestamp with time zone NOT NULL,
  tipo_sensor USER-DEFINED NOT NULL,
  path_mapa_procesado character varying,
  CONSTRAINT Vuelos_Dron_pkey PRIMARY KEY (id_vuelo),
  CONSTRAINT Vuelos_Dron_id_parcela_fkey FOREIGN KEY (id_parcela) REFERENCES public.Parcelas(id_parcela)
);
CREATE TABLE public.alertas_mapa (
  id integer NOT NULL DEFAULT nextval('alertas_mapa_id_seq'::regclass),
  vuelo_id integer NOT NULL,
  amenaza_inferida_id integer,
  coordenadas_foco USER-DEFINED NOT NULL,
  severidad_estimada real,
  estado_alerta USER-DEFINED NOT NULL DEFAULT 'NUEVA'::estado_alerta_enum,
  tecnico_asignado_id integer,
  CONSTRAINT alertas_mapa_pkey PRIMARY KEY (id),
  CONSTRAINT alertas_mapa_vuelo_id_fkey FOREIGN KEY (vuelo_id) REFERENCES public.vuelos_dron(id),
  CONSTRAINT alertas_mapa_amenaza_inferida_id_fkey FOREIGN KEY (amenaza_inferida_id) REFERENCES public.amenazas(id),
  CONSTRAINT alertas_mapa_tecnico_asignado_id_fkey FOREIGN KEY (tecnico_asignado_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.amenaza_control (
  amenaza_id integer NOT NULL,
  metodo_control_id integer NOT NULL,
  CONSTRAINT amenaza_control_pkey PRIMARY KEY (amenaza_id, metodo_control_id),
  CONSTRAINT amenaza_control_amenaza_id_fkey FOREIGN KEY (amenaza_id) REFERENCES public.amenazas(id),
  CONSTRAINT amenaza_control_metodo_control_id_fkey FOREIGN KEY (metodo_control_id) REFERENCES public.metodos_control(id)
);
CREATE TABLE public.amenaza_sintoma (
  amenaza_id integer NOT NULL,
  sintoma_id integer NOT NULL,
  CONSTRAINT amenaza_sintoma_pkey PRIMARY KEY (amenaza_id, sintoma_id),
  CONSTRAINT amenaza_sintoma_amenaza_id_fkey FOREIGN KEY (amenaza_id) REFERENCES public.amenazas(id),
  CONSTRAINT amenaza_sintoma_sintoma_id_fkey FOREIGN KEY (sintoma_id) REFERENCES public.sintomas(id)
);
CREATE TABLE public.amenazas (
  id integer NOT NULL DEFAULT nextval('amenazas_id_seq'::regclass),
  nombre_comun character varying NOT NULL,
  nombre_cientifico character varying,
  nombre_clave character varying UNIQUE,
  descripcion_general text,
  impacto_economico character varying,
  distribucion_global text,
  categoria_id integer,
  taxonomia_id integer,
  CONSTRAINT amenazas_pkey PRIMARY KEY (id),
  CONSTRAINT amenazas_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.categorias(id),
  CONSTRAINT amenazas_taxonomia_id_fkey FOREIGN KEY (taxonomia_id) REFERENCES public.taxonomia(id)
);
CREATE TABLE public.categorias (
  id integer NOT NULL DEFAULT nextval('categorias_id_seq'::regclass),
  nombre character varying NOT NULL,
  descripcion text,
  parent_id integer,
  CONSTRAINT categorias_pkey PRIMARY KEY (id),
  CONSTRAINT categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categorias(id)
);
CREATE TABLE public.departamentos (
  id integer NOT NULL DEFAULT nextval('departamentos_id_seq'::regclass),
  nombre_depto character varying NOT NULL,
  pais_id integer NOT NULL,
  CONSTRAINT departamentos_pkey PRIMARY KEY (id),
  CONSTRAINT departamentos_pais_id_fkey FOREIGN KEY (pais_id) REFERENCES public.paises(id)
);
CREATE TABLE public.detecciones_campo (
  id integer NOT NULL DEFAULT nextval('detecciones_campo_id_seq'::regclass),
  usuario_id integer NOT NULL,
  amenaza_detectada_id integer NOT NULL,
  ubicacion USER-DEFINED NOT NULL,
  precision_gps real,
  fecha_hora_scan timestamp with time zone NOT NULL DEFAULT now(),
  imagen_scan_id integer NOT NULL,
  confianza_ia real,
  modo_diagnostico USER-DEFINED NOT NULL,
  estado_validacion USER-DEFINED NOT NULL DEFAULT 'PENDIENTE'::estado_validacion_enum,
  verificador_id integer,
  notas_usuario text,
  municipio_id integer,
  parcela_id integer,
  CONSTRAINT detecciones_campo_pkey PRIMARY KEY (id),
  CONSTRAINT detecciones_campo_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT detecciones_campo_amenaza_detectada_id_fkey FOREIGN KEY (amenaza_detectada_id) REFERENCES public.amenazas(id),
  CONSTRAINT detecciones_campo_imagen_scan_id_fkey FOREIGN KEY (imagen_scan_id) REFERENCES public.imagenes(id),
  CONSTRAINT detecciones_campo_verificador_id_fkey FOREIGN KEY (verificador_id) REFERENCES public.usuarios(id),
  CONSTRAINT detecciones_campo_municipio_id_fkey FOREIGN KEY (municipio_id) REFERENCES public.municipios(id),
  CONSTRAINT detecciones_campo_parcela_id_fkey FOREIGN KEY (parcela_id) REFERENCES public.parcelas(id)
);
CREATE TABLE public.imagenes (
  id integer NOT NULL DEFAULT nextval('imagenes_id_seq'::regclass),
  path_almacenamiento character varying NOT NULL,
  descripcion text,
  usuario_subida_id integer,
  CONSTRAINT imagenes_pkey PRIMARY KEY (id),
  CONSTRAINT imagenes_usuario_subida_id_fkey FOREIGN KEY (usuario_subida_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.media_assets (
  id bigint NOT NULL DEFAULT nextval('media_assets_id_seq'::regclass),
  bucket text NOT NULL,
  path text NOT NULL,
  cultivo text NOT NULL,
  taxon text NOT NULL,
  enfermedad_slug text NOT NULL,
  title text,
  descripcion text,
  is_cover boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT media_assets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.metodos_control (
  id integer NOT NULL DEFAULT nextval('metodos_control_id_seq'::regclass),
  tipo_control character varying NOT NULL,
  descripcion text NOT NULL,
  CONSTRAINT metodos_control_pkey PRIMARY KEY (id)
);
CREATE TABLE public.municipios (
  id integer NOT NULL DEFAULT nextval('municipios_id_seq'::regclass),
  nombre_municipio character varying NOT NULL,
  depto_id integer NOT NULL,
  CONSTRAINT municipios_pkey PRIMARY KEY (id),
  CONSTRAINT municipios_depto_id_fkey FOREIGN KEY (depto_id) REFERENCES public.departamentos(id)
);
CREATE TABLE public.organos_afectados (
  id integer NOT NULL DEFAULT nextval('organos_afectados_id_seq'::regclass),
  nombre_organo character varying NOT NULL UNIQUE,
  CONSTRAINT organos_afectados_pkey PRIMARY KEY (id)
);
CREATE TABLE public.paises (
  id integer NOT NULL DEFAULT nextval('paises_id_seq'::regclass),
  nombre_pais character varying NOT NULL UNIQUE,
  codigo_iso character varying UNIQUE,
  CONSTRAINT paises_pkey PRIMARY KEY (id)
);
CREATE TABLE public.parcelas (
  id integer NOT NULL DEFAULT nextval('parcelas_id_seq'::regclass),
  usuario_id integer NOT NULL,
  nombre_parcela character varying NOT NULL,
  ubicacion_centro USER-DEFINED,
  area_hectareas numeric,
  geometria_poligono USER-DEFINED,
  CONSTRAINT parcelas_pkey PRIMARY KEY (id),
  CONSTRAINT parcelas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.referencias (
  id integer NOT NULL DEFAULT nextval('referencias_id_seq'::regclass),
  nombre_fuente character varying NOT NULL,
  url_referencia character varying,
  titulo_publicacion character varying,
  autores text,
  año_publicacion integer,
  tipo_fuente character varying,
  doi character varying,
  fecha_acceso date,
  CONSTRAINT referencias_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sintomas (
  id integer NOT NULL DEFAULT nextval('sintomas_id_seq'::regclass),
  descripcion text NOT NULL,
  organo_afectado_id integer,
  CONSTRAINT sintomas_pkey PRIMARY KEY (id),
  CONSTRAINT sintomas_organo_afectado_id_fkey FOREIGN KEY (organo_afectado_id) REFERENCES public.organos_afectados(id)
);
CREATE TABLE public.taxonomia (
  id integer NOT NULL DEFAULT nextval('taxonomia_id_seq'::regclass),
  reino character varying,
  phylum character varying,
  clase character varying,
  orden character varying,
  familia character varying,
  genero character varying,
  especie character varying,
  CONSTRAINT taxonomia_pkey PRIMARY KEY (id)
);
CREATE TABLE public.usuarios (
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  nombre_completo character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  password_hash character varying,
  fecha_registro timestamp with time zone NOT NULL DEFAULT now(),
  auth_user_id uuid UNIQUE,
  rol USER-DEFINED NOT NULL,
  rol_especifico character varying,
  es_superusuario boolean NOT NULL DEFAULT false,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.vuelos_dron (
  id integer NOT NULL DEFAULT nextval('vuelos_dron_id_seq'::regclass),
  parcela_id integer NOT NULL,
  fecha_hora_vuelo timestamp with time zone NOT NULL,
  tipo_sensor USER-DEFINED NOT NULL,
  path_mapa_procesado character varying,
  CONSTRAINT vuelos_dron_pkey PRIMARY KEY (id),
  CONSTRAINT vuelos_dron_parcela_id_fkey FOREIGN KEY (parcela_id) REFERENCES public.parcelas(id)
);
-- --------------------------------------------------------------------------------
-- FIN DEL SCRIPT DE CREACIÓN
-- --------------------------------------------------------------------------------
