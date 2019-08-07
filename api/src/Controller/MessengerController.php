<?php
namespace Crypter\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\IsGranted;

use Carbon\Carbon;

use Doctrine\ORM\EntityManagerInterface;

use Crypter\Entity\User;
use Crypter\Entity\Conference;
use Crypter\Entity\ConferenceReference;
use Crypter\Entity\Participant;
use Crypter\Entity\Message;
use Crypter\Entity\MessageReference;


class MessengerController extends AbstractController
{
    private $validator;

    private $em;

    private $passwordEncoder;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    /**
     * @Route("/api/search", name="search_user")
     *
     */
    public function searchUser(Request $request): Response
    {
        $query = $request->query->get('name');

        $users = $this->em->getRepository(User::class)->search($query);

        $json = [];

        foreach ($users as $user) {
            $json[] = [
                'uuid' => $user->getUuid(),
                'name' => $user->getName()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conferences", name="get_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferences(Request $request): Response
    {
        $user = $this->getUser();

        $conferences = $this->em->getRepository(User::class)->getConferences($user);

        $json = [];

        foreach ($conferences as $key => $conference) {
            $participant = $this->em->getRepository(User::class)->find($conference['participant']);

            $json[$key] = [
                'uuid' => $conference[0]->getUuid(),
                'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
                'count' => $conference['count'],
                'unread' => $conference['unread'],
                'participant' => [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName()
                ],
                'participants' => [],
                'messages' => []
            ];

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName()
                ];
            }

            $messages = $this->em->getRepository(Conference::class)->getMessages($conference[0], $user);

            foreach ($messages as $message) {
                $json[$key]['messages'][] = [
                    'uuid' => $message[0]->getUuid(),
                    'author' => [
                        'uuid' => $message[0]->getAuthor()->getUuid(),
                        'name' => $message[0]->getAuthor()->getName()
                    ],
                    'conference' => [
                        'uuid' => $message['conference']
                    ],
                    'readed' => $message[0]->getReaded(),
                    'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                    'date' => (float) $message[0]->getDate()->format('U.u'),
                    'type' => $message[0]->getType(),
                    'content' => $message[0]->getContent(),
                    'consumed' => $message[0]->getConsumed(),
                    'edited' => $message[0]->getEdited()
                ];
            }
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conference/{conference}", name="get_conference")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConference(Request $request, $conference): Response
    {
        $user = $this->getUser();

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $participant = $this->em->getRepository(User::class)->find($conference['participant']);

        $json = [
            'uuid' => $conference[0]->getUuid(),
            'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
            'count' => $conference['count'],
            'unread' => $conference['unread'],
            'participant' => [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName()
            ],
            'participants' => [],
            'messages' => []
        ];

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName()
            ];
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conference[0], $user);

        foreach ($messages as $message) {
            $json['messages'][] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/conference_by_participant/{participant}", name="get_conference_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceByParticipant(Request $request, $participant): Response
    {
        $user = $this->getUser();

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
           return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $json = [
            'uuid' => $conference[0]->getUuid(),
            'updated' => (float) $conference[0]->getUpdated()->format('U.u'),
            'count' => $conference['count'],
            'unread' => $conference['unread'],
            'participant' => [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName()
            ],
            'participants' => [],
            'messages' => []
        ];

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference[0]);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName()
            ];
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conference[0], $user);

        foreach ($messages as $message) {
            $json['messages'][] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/messages", name="get_messages")
     *
     * @IsGranted("ROLE_USER")
     *
     * @TODO: Delete this unnecessary method
     */
    public function getMessages(Request $request): Response
    {
        $user = $this->getUser();

        $messages = $this->em->getRepository(User::class)->getMessages($user);

        $json = [];

        foreach ($messages as $message) {
            $author = $message[0]->getAuthor();

            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/readed_messages/", name="get_readed_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getReadedMessages(Request $request): Response
    {
        // somewhy DateTime round milliseconds from unix timestamp
        $date = Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000);

        $user = $this->getUser();

        $messages = $this->em->getRepository(User::class)->getReadedMessages($user, $date);

        $json = [];

        foreach ($messages as $message) {
            $author = $message[0]->getAuthor();

            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/messages/{conference}", name="get_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessages(Request $request, $conference): Response
    {
        $user = $this->getUser();

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conference[0], $user);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages/{conference}", name="get_unread_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessages(Request $request, $conference): Response
    {
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conference[0], $user, $limit);

        $json = [];

        foreach ($messages as $message) {
            $author = $message[0]->getAuthor();

            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages/{conference}", name="get_old_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessages(Request $request, $conference): Response
    {
        // somewhy DateTime round milliseconds from unix timestamp
        $date = Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conference[0], $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' =>  (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages/{conference}", name="get_new_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessages(Request $request, $conference): Response
    {
        // somewhy DateTime round milliseconds from unix timestamp
        $date = Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $conference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conference[0], $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference']
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' =>  (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }


    /**
     * @Route("/api/messenger/messages_by_participant/{participant}", name="get_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        $user = $this->getUser();

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conference[0], $user);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference'],
                    'participant' => $participant->getUuid()
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages_by_participant/{participant}", name="get_unread_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conference[0], $user, $limit);

        $json = [];

        foreach ($messages as $message) {
            $author = $message[0]->getAuthor();

            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference'],
                    'participant' => $participant->getUuid()
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' => (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages_by_participant/{participant}", name="get_old_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // somewhy DateTime round milliseconds from unix timestamp
        $date = Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conference[0], $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference'],
                    'participant' => $participant->getUuid()
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' =>  (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages_by_participant/{participant}", name="get_new_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // somewhy DateTime round milliseconds from unix timestamp
        $date = Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->em->getRepository(Conference::class)::BATCH_SIZE;

        $user = $this->getUser();

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conference[0], $user, $date, $limit);

        $json = [];

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message[0]->getUuid(),
                'author' => [
                    'uuid' => $message[0]->getAuthor()->getUuid(),
                    'name' => $message[0]->getAuthor()->getName()
                ],
                'conference' => [
                    'uuid' => $message['conference'],
                    'participant' => $participant->getUuid()
                ],
                'readed' => $message[0]->getReaded(),
                'readedAt' => ($message[0]->getReadedAt()) ? (float) $message[0]->getReadedAt()->format('U.u') : $message[0]->getReadedAt(),
                'date' =>  (float) $message[0]->getDate()->format('U.u'),
                'type' => $message[0]->getType(),
                'content' => $message[0]->getContent(),
                'consumed' => $message[0]->getConsumed(),
                'edited' => $message[0]->getEdited()
            ];
        }

        return new JsonResponse($json);
    }


    /**
     * @Route("/api/messenger/message/{user}", methods={"POST"}, name="send_message")
     *
     * @IsGranted("ROLE_USER")
     */
    public function sendMessage(Request $request, $user): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        $sender = $this->getUser();

        $reciever = $this->em->find(User::class, $user);

        if (!$reciever) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(Conference::class)->getConferenceByParticipant($sender, $reciever);

        if (!$conference) {
            $conference = new Conference();
            $this->em->persist($conference);

            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($reciever);
            $this->em->persist($senderConferenceReference);

            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($reciever);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);

            $senderParticipant = new Participant();
            $senderParticipant->setConference($conference);
            $senderParticipant->setUser($sender);
            $this->em->persist($senderParticipant);

            $receiverParticipant = new Participant();
            $receiverParticipant->setConference($conference);
            $receiverParticipant->setUser($reciever);
            $this->em->persist($receiverParticipant);
        }


        $senderConferenceReference =  $senderConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $sender->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$senderConferenceReference) {
            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($reciever);
            $this->em->persist($senderConferenceReference);
        }


        $receiverConferenceReference = $receiverConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $reciever->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$receiverConferenceReference) {
            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($reciever);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);
        }


        $message = new Message();
        $message->setAuthor($sender);
        $message->setType('text/plain');
        $message->setContent($data['text']);
        $message->setEdited(false);
        $this->em->persist($message);

        $senderMessageReference = new MessageReference();
        $senderMessageReference->setConference($conference);
        $senderMessageReference->setUser($sender);
        $senderMessageReference->setMessage($message);
        $this->em->persist($senderMessageReference);
        
        $receiverMessageReference = new MessageReference();
        $receiverMessageReference->setConference($conference);
        $receiverMessageReference->setUser($reciever);
        $receiverMessageReference->setMessage($message);
        $this->em->persist($receiverMessageReference);


        $conference->setUpdated((new \DateTime()));
        $this->em->persist($conference);

        $senderConferenceReference->setCount($senderConferenceReference->getCount() + 1);
        $this->em->persist($senderConferenceReference);

        $receiverConferenceReference->setCount($receiverConferenceReference->getCount() + 1);
        $receiverConferenceReference->setUnread($receiverConferenceReference->getUnread() + 1);
        $this->em->persist($receiverConferenceReference);


        $this->em->flush();

        $json = [
            'data' => [
                'to' => $user,
                'text' => $data['text']
            ],
            'conference' => [
                'uuid' => $conference->getUuid(),
                'updated' => $conference->getUpdated(),
                'participants' => [
                    [
                        'uuid' => $sender->getUuid(),
                        'name' => $sender->getName(),
                    ],
                    [
                        'uuid' => $reciever->getUuid(),
                        'name' => $sender->getName()
                    ]
                ]
            ],
            'conference_references' => [
                [
                    'uuid' => $senderConferenceReference->getUuid(),
                    'conference' => $senderConferenceReference->getConference()->getUuid(),
                    'count' => $senderConferenceReference->getCount(),
                    'unread' => $senderConferenceReference->getUnread()
                ],
                [
                    'uuid' => $receiverConferenceReference->getUuid(),
                    'conference' => $receiverConferenceReference->getConference()->getUuid(),
                    'count' => $receiverConferenceReference->getCount(),
                    'unread' => $receiverConferenceReference->getUnread()
                ]
            ],
            'message' => [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName()
                ],
                'readed' => $message->getReaded(),
                'readedAt' => ($message->getReadedAt()) ? (float) $message->getReadedAt()->format('U.u') : $message->getReadedAt(),
                'date' => $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ]
        ];

        return new JsonResponse($json);
    }
}