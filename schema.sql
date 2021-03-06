--
-- PostgreSQL database dump
--

-- Dumped from database version 12.2
-- Dumped by pg_dump version 12.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: conference_type; Type: TYPE; Schema: public; Owner: crypter
--

CREATE TYPE public.conference_type AS ENUM (
    'private',
    'public',
    'secret'
);


ALTER TYPE public.conference_type OWNER TO crypter;

--
-- Name: message_type; Type: TYPE; Schema: public; Owner: crypter
--

CREATE TYPE public.message_type AS ENUM (
    'text/plain',
    'audio/ogg',
    'video/mp4'
);


ALTER TYPE public.message_type OWNER TO crypter;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: conference; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.conference (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.conference_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.conference OWNER TO crypter;

--
-- Name: conference_reference; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.conference_reference (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "user" uuid NOT NULL,
    conference uuid NOT NULL,
    unread_messages_count integer DEFAULT 0 NOT NULL,
    participant uuid,
    messages_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message uuid
);


ALTER TABLE public.conference_reference OWNER TO crypter;

--
-- Name: message; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.message (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    author uuid NOT NULL,
    read boolean DEFAULT false NOT NULL,
    date timestamp with time zone DEFAULT now() NOT NULL,
    type public.message_type NOT NULL,
    content text NOT NULL,
    consumed boolean,
    edited boolean,
    read_at timestamp with time zone,
    conference uuid NOT NULL
);


ALTER TABLE public.message OWNER TO crypter;

--
-- Name: COLUMN message.type; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message.type IS 'MUST be either text/plain for text messages, or audio/ogg for voice, or video/mp4 for video';


--
-- Name: COLUMN message.content; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message.content IS 'MUST contain either plain text for text message or url to media file for voice/video message';


--
-- Name: COLUMN message.consumed; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message.consumed IS 'defines whether or not a voice/video message is listened/watched';


--
-- Name: COLUMN message.edited; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message.edited IS 'defines whether or not text message is edited';


--
-- Name: message_attachment; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.message_attachment (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message uuid NOT NULL,
    type character varying NOT NULL,
    src character varying NOT NULL
);


ALTER TABLE public.message_attachment OWNER TO crypter;

--
-- Name: COLUMN message_attachment.type; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message_attachment.type IS 'MUST be equal to either "image", "audio", "video", "file", "forwarding", "reply"';


--
-- Name: COLUMN message_attachment.src; Type: COMMENT; Schema: public; Owner: crypter
--

COMMENT ON COLUMN public.message_attachment.src IS 'MUST contain either url to file for image/audio/video/file types or uuid of message for forwarding/reply types';


--
-- Name: message_reference; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.message_reference (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "user" uuid NOT NULL,
    message uuid NOT NULL
);


ALTER TABLE public.message_reference OWNER TO crypter;

--
-- Name: participant; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public.participant (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conference uuid NOT NULL,
    "user" uuid NOT NULL
);


ALTER TABLE public.participant OWNER TO crypter;

--
-- Name: user; Type: TABLE; Schema: public; Owner: crypter
--

CREATE TABLE public."user" (
    uuid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    hash character varying(60) NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    public_key text NOT NULL,
    private_key text NOT NULL,
    revocation_certificate text NOT NULL,
    conferences_count integer DEFAULT 0 NOT NULL,
    fingerprint character varying NOT NULL
);


ALTER TABLE public."user" OWNER TO crypter;

--
-- Name: conference conference_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference
    ADD CONSTRAINT conference_pkey PRIMARY KEY (uuid);


--
-- Name: conference_reference conference_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference_reference
    ADD CONSTRAINT conference_reference_pkey PRIMARY KEY (uuid);


--
-- Name: message_attachment message_attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message_attachment
    ADD CONSTRAINT message_attachment_pkey PRIMARY KEY (uuid);


--
-- Name: message message_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_pkey PRIMARY KEY (uuid);


--
-- Name: message_reference message_reference_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message_reference
    ADD CONSTRAINT message_reference_pkey PRIMARY KEY (uuid);


--
-- Name: participant participant_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.participant
    ADD CONSTRAINT participant_pkey PRIMARY KEY (uuid);


--
-- Name: user unique_email; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT unique_email UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (uuid);


--
-- Name: conference_reference conference_reference_conference_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference_reference
    ADD CONSTRAINT conference_reference_conference_fkey FOREIGN KEY (conference) REFERENCES public.conference(uuid);


--
-- Name: conference_reference conference_reference_last_message_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference_reference
    ADD CONSTRAINT conference_reference_last_message_fkey FOREIGN KEY (last_message) REFERENCES public.message(uuid);


--
-- Name: conference_reference conference_reference_participant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference_reference
    ADD CONSTRAINT conference_reference_participant_fkey FOREIGN KEY (participant) REFERENCES public."user"(uuid);


--
-- Name: conference_reference conference_reference_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.conference_reference
    ADD CONSTRAINT conference_reference_user_fkey FOREIGN KEY ("user") REFERENCES public."user"(uuid);


--
-- Name: message_attachment message_attachment_message_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message_attachment
    ADD CONSTRAINT message_attachment_message_fkey FOREIGN KEY (message) REFERENCES public.message(uuid);


--
-- Name: message message_conference_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_conference_fkey FOREIGN KEY (conference) REFERENCES public.conference(uuid);


--
-- Name: message_reference message_reference_message_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message_reference
    ADD CONSTRAINT message_reference_message_fkey FOREIGN KEY (message) REFERENCES public.message(uuid);


--
-- Name: message_reference message_reference_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message_reference
    ADD CONSTRAINT message_reference_user_fkey FOREIGN KEY ("user") REFERENCES public."user"(uuid);


--
-- Name: message message_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.message
    ADD CONSTRAINT message_user_fkey FOREIGN KEY (author) REFERENCES public."user"(uuid);


--
-- Name: participant participant_conference_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.participant
    ADD CONSTRAINT participant_conference_fkey FOREIGN KEY (conference) REFERENCES public.conference(uuid);


--
-- Name: participant participant_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: crypter
--

ALTER TABLE ONLY public.participant
    ADD CONSTRAINT participant_user_fkey FOREIGN KEY ("user") REFERENCES public."user"(uuid);


--
-- PostgreSQL database dump complete
--

