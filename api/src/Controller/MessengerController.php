<?php
namespace Crypter\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\JsonResponse;

use Symfony\Component\Validator\Validation;
use Symfony\Component\Validator\Constraints\Uuid as UuidConstraint;

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
                'name' => $user->getName(),
                'public_key' => $user->getPublicKey()
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
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferenceReferences = $this->em->getRepository(User::class)->getConferences($user, $date, $limit);

        $json = [];

        foreach ($conferenceReferences as $key => $conferenceReference) {
            $conference = $conferenceReference->getConference();

            $json[$key] = [
                'uuid' => $conference->getUuid(),
                'type' => $conference->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json[$key]['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            if ($lastMessage = $conferenceReference->getLastMessage()) {
                $json[$key]['last_message'] = [
                    'uuid' => $lastMessage->getUuid(),
                    'author' => [
                        'uuid' => $lastMessage->getAuthor()->getUuid(),
                        'name' => $lastMessage->getAuthor()->getName(),
                        'public_key' => $lastMessage->getAuthor()->getPublicKey()
                    ],
                    'conference' => [
                        'uuid' => $conference->getUuid(),
                        'type' => $conference->getType(),
                        'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                        'messages_count' => $conferenceReference->getMessagesCount(),
                        'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    ],
                    'read' => $lastMessage->getRead(),
                    'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                    'date' => (float) $lastMessage->getDate()->format('U.u'),
                    'type' => $lastMessage->getType(),
                    'content' => $lastMessage->getContent(),
                    'consumed' => $lastMessage->getConsumed(),
                    'edited' => $lastMessage->getEdited()
                ];

                if ($participant = $conferenceReference->getParticipant()) {
                    $json[$key]['last_message']['conference']['participant'] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }

                foreach($participants as $participant) {
                    $json[$key]['last_message']['conference']['participants'][] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }
            }
        }

        usort($json, function($a, $b) {
            return $b['updated_at'] - $a['updated_at'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_conferences", name="get_old_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferences(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferenceReferences = $this->em->getRepository(User::class)->getOldConferences($user, $date, $limit);

        $json = [];

        foreach ($conferenceReferences as $key => $conferenceReference) {
            $conference = $conferenceReference->getConference();

            $json[$key] = [
                'uuid' => $conference->getUuid(),
                'type' => $conference->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json[$key]['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            if ($lastMessage = $conferenceReference->getLastMessage()) {
                $json[$key]['last_message'] = [
                    'uuid' => $lastMessage->getUuid(),
                    'author' => [
                        'uuid' => $lastMessage->getAuthor()->getUuid(),
                        'name' => $lastMessage->getAuthor()->getName(),
                        'public_key' => $lastMessage->getAuthor()->getPublicKey()
                    ],
                    'conference' => [
                        'uuid' => $conference->getUuid(),
                        'type' => $conference->getType(),
                        'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                        'messages_count' => $conferenceReference->getMessagesCount(),
                        'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    ],
                    'read' => $lastMessage->getRead(),
                    'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                    'date' => (float) $lastMessage->getDate()->format('U.u'),
                    'type' => $lastMessage->getType(),
                    'content' => $lastMessage->getContent(),
                    'consumed' => $lastMessage->getConsumed(),
                    'edited' => $lastMessage->getEdited()
                ];

                if ($participant = $conferenceReference->getParticipant()) {
                    $json[$key]['last_message']['conference']['participant'] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }

                foreach($participants as $participant) {
                    $json[$key]['last_message']['conference']['participants'][] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }
            }
        }

        usort($json, function($a, $b) {
            return $b['updated_at'] - $a['updated_at'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_conferences", name="get_new_conferences")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferences(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $conferenceReferences = $this->em->getRepository(User::class)->getNewConferences($user, $date, $limit);

        $json = [];

        foreach ($conferenceReferences as $key => $conferenceReference) {
            $conference = $conferenceReference->getConference();

            $json[$key] = [
                'uuid' => $conference->getUuid(),
                'type' => $conference->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json[$key]['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

            foreach ($participants as $participant) {
                $json[$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            if ($lastMessage = $conferenceReference->getLastMessage()) {
                $json[$key]['last_message'] = [
                    'uuid' => $lastMessage->getUuid(),
                    'author' => [
                        'uuid' => $lastMessage->getAuthor()->getUuid(),
                        'name' => $lastMessage->getAuthor()->getName(),
                        'public_key' => $lastMessage->getAuthor()->getPublicKey()
                    ],
                    'conference' => [
                        'uuid' => $conference->getUuid(),
                        'type' => $conference->getType(),
                        'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                        'messages_count' => $conferenceReference->getMessagesCount(),
                        'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    ],
                    'read' => $lastMessage->getRead(),
                    'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                    'date' => (float) $lastMessage->getDate()->format('U.u'),
                    'type' => $lastMessage->getType(),
                    'content' => $lastMessage->getContent(),
                    'consumed' => $lastMessage->getConsumed(),
                    'edited' => $lastMessage->getEdited()
                ];

                if ($participant = $conferenceReference->getParticipant()) {
                    $json[$key]['last_message']['conference']['participant'] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }

                foreach($participants as $participant) {
                    $json[$key]['last_message']['conference']['participants'][] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }
            }
        }

        usort($json, function($a, $b) {
            return $b['updated_at'] - $a['updated_at'];
        });

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

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(User::class)->getConference($conference, $user);

        if (!$conferenceReference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $conference = $conferenceReference->getConference();

        $json = [
            'uuid' => $conference->getUuid(),
            'type' => $conference->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $json['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        if ($lastMessage = $conferenceReference->getLastMessage()) {
            $json['last_message'] = [
                'uuid' => $lastMessage->getUuid(),
                'author' => [
                    'uuid' => $lastMessage->getAuthor()->getUuid(),
                    'name' => $lastMessage->getAuthor()->getName(),
                    'public_key' => $lastMessage->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conference->getUuid(),
                    'type' => $conference->getType(),
                    'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                    'messages_count' => $conferenceReference->getMessagesCount(),
                    'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                ],
                'read' => $lastMessage->getRead(),
                'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                'date' => (float) $lastMessage->getDate()->format('U.u'),
                'type' => $lastMessage->getType(),
                'content' => $lastMessage->getContent(),
                'consumed' => $lastMessage->getConsumed(),
                'edited' => $lastMessage->getEdited()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json['last_message']['conference']['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            foreach($participants as $participant) {
                $json['last_message']['conference']['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
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

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
           return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(User::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $conference = $conferenceReference->getConference();

        $json = [
            'uuid' => $conference->getUuid(),
            'type' => $conference->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $json['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        if ($lastMessage = $conferenceReference->getLastMessage()) {
            $json['last_message'] = [
                'uuid' => $lastMessage->getUuid(),
                'author' => [
                    'uuid' => $lastMessage->getAuthor()->getUuid(),
                    'name' => $lastMessage->getAuthor()->getName(),
                    'public_key' => $lastMessage->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conference->getUuid(),
                    'type' => $conference->getType(),
                    'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                    'messages_count' => $conferenceReference->getMessagesCount(),
                    'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                ],
                'read' => $lastMessage->getRead(),
                'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                'date' => (float) $lastMessage->getDate()->format('U.u'),
                'type' => $lastMessage->getType(),
                'content' => $lastMessage->getContent(),
                'consumed' => $lastMessage->getConsumed(),
                'edited' => $lastMessage->getEdited()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json['last_message']['conference']['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            foreach($participants as $participant) {
                $json['last_message']['conference']['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/secret_conference_by_participant/{participant}", name="get_secret_conference_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getSecretConferenceByParticipant(Request $request, $participant): Response
    {
        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
           return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(User::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Not Found', Response::HTTP_NOT_FOUND);
        }

        $conference = $conferenceReference->getConference();

        $json = [
            'uuid' => $conference->getUuid(),
            'type' => $conference->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $json['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

        foreach ($participants as $participant) {
            $json['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        if ($lastMessage = $conferenceReference->getLastMessage()) {
            $json['last_message'] = [
                'uuid' => $lastMessage->getUuid(),
                'author' => [
                    'uuid' => $lastMessage->getAuthor()->getUuid(),
                    'name' => $lastMessage->getAuthor()->getName(),
                    'public_key' => $lastMessage->getAuthor()->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $conference->getUuid(),
                    'type' => $conference->getType(),
                    'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                    'messages_count' => $conferenceReference->getMessagesCount(),
                    'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                ],
                'read' => $lastMessage->getRead(),
                'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                'date' => (float) $lastMessage->getDate()->format('U.u'),
                'type' => $lastMessage->getType(),
                'content' => $lastMessage->getContent(),
                'consumed' => $lastMessage->getConsumed(),
                'edited' => $lastMessage->getEdited()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $json['last_message']['conference']['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            foreach($participants as $participant) {
                $json['last_message']['conference']['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }
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
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => [
                    'uuid' => $message->getConference()->getUuid()
                ],
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/read_messages/", name="get_read_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getReadMessages(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);

        $user = $this->getUser();

        $messages = $this->em->getRepository(User::class)->getReadMessages($user, $date);

        $json = [];

        foreach ($messages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'type' => $conferenceReference->getConference()->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

            foreach ($participants as $participant) {
                $conference['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/messages/{conference}", name="get_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date, $limit);
        
        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages/{conference}", name="get_unread_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUser(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages_with_messages_before/{conference}", name="get_unread_conference_messages_with_messages_before")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessagesWithMessagesBefore(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUser(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $unreadMessages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $limit);

        $messagesBefore = [];

        if (count($unreadMessages) > 0) {
            $date = array_values(array_slice($unreadMessages, 0, 1))[0]->getDate();

            $messagesBefore = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date);
        }

        $messages = array_merge($messagesBefore, $unreadMessages);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages/{conference}", name="get_old_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages/{conference}", name="get_new_conference_messages")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessages(Request $request, $conference): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($conference, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $user->getUuid(), 'conference' => $conference]);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }


    /**
     * @Route("/api/messenger/messages_by_participant/{participant}", name="get_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages_by_participant/{participant}", name="get_unread_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_messages_with_messages_before_by_participant/{participant}", name="get_unread_conference_messages_with_messages_before_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadConferenceMessagesWithMessagesBeforeByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $unreadMessages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $date, $limit);

        $messagesBefore = [];

        if (count($unreadMessages) > 0) {
            $date = array_values(array_slice($unreadMessages, 0, 1))[0]->getDate();

            $messagesBefore = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date);
        }

        $messages = array_merge($messagesBefore, $unreadMessages);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_messages_by_participant/{participant}", name="get_old_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_messages_by_participant/{participant}", name="get_new_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/secret_messages_by_participant/{participant}", name="get_secret_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getSecretConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_secret_messages_by_participant/{participant}", name="get_unread_secret_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadSecretConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/unread_secret_messages_with_messages_before_by_participant/{participant}", name="get_unread_secret_conference_messages_with_messages_before_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getUnreadSecretConferenceMessagesWithMessagesBeforeByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $unreadMessages = $this->em->getRepository(Conference::class)->getUnreadMessages($conferenceReference->getConference(), $user, $date, $limit);

        $messagesBefore = [];

        if (count($unreadMessages) > 0) {
            $date = array_values(array_slice($unreadMessages, 0, 1))[0]->getDate();

            $messagesBefore = $this->em->getRepository(Conference::class)->getMessages($conferenceReference->getConference(), $user, $date);
        }

        $messages = array_merge($messagesBefore, $unreadMessages);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $author = $message->getAuthor();

            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $author->getUuid(),
                    'name' => $author->getName(),
                    'public_key' => $author->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/old_secret_messages_by_participant/{participant}", name="get_secret_old_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getOldSecretConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::now();
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getOldMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/new_secret_messages_by_participant/{participant}", name="get_new_secret_conference_messages_by_participant")
     *
     * @IsGranted("ROLE_USER")
     */
    public function getNewSecretConferenceMessagesByParticipant(Request $request, $participant): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $date = ($request->query->has('timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $limit = ($request->query->has('limit')) ? $request->query->get('limit') : $this->getParameter('BATCH_SIZE');

        $user = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($participant, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->getRepository(User::class)->find($participant);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conferenceReference = $this->em->getRepository(ConferenceReference::class)->getSecretConferenceByParticipant($participant->getUuid(), $user);

        if (!$conferenceReference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $messages = $this->em->getRepository(Conference::class)->getNewMessages($conferenceReference->getConference(), $user, $date, $limit);

        $json = [];

        $conference = [
            'uuid' => $conferenceReference->getConference()->getUuid(),
            'type' => $conferenceReference->getConference()->getType(),
            'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
            'messages_count' => $conferenceReference->getMessagesCount(),
            'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
        ];

        if ($participant = $conferenceReference->getParticipant()) {
            $conference['participant'] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

        foreach ($participants as $participant) {
            $conference['participants'][] = [
                'uuid' => $participant->getUuid(),
                'name' => $participant->getName(),
                'public_key' => $participant->getPublicKey()
            ];
        }

        foreach ($messages as $message) {
            $json[] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' =>  (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json, function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/synchronize/", name="synchronize")
     *
     * @IsGranted("ROLE_USER")
     */
    public function synchronize(Request $request): Response
    {
        // for some reason DateTime round milliseconds from unix timestamp
        $minDate = ($request->query->has('min_timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('min_timestamp') * 1000) : Carbon::createFromTimestampMs(0);
        $maxDate = ($request->query->has('max_timestamp')) ? Carbon::createFromTimestampMs((float) $request->query->get('max_timestamp') * 1000) : Carbon::now();

        $user = $this->getUser();

        $conferenceReferences = $this->em->getRepository(User::class)->getUpdatedConferences($user, $maxDate);
        $messages = $this->em->getRepository(User::class)->getUpdatedMessages($user, $maxDate);
        $readMessages = $this->em->getRepository(User::class)->getReadMessages($user, $maxDate);
        $unreadMessages = $this->em->getRepository(User::class)->getUnreadMessages($user, $minDate);

        $json = [
            'conferences' => [],
            'messages' => [],
            'read_messages' => [],
            'unread_messages' => []
        ];

        foreach ($conferenceReferences as $key => $conferenceReference) {
            $conference = $conferenceReference->getConference();

            $json['conferences'][$key] = [
                'uuid' => $conference->getUuid(),
                'type' => $conference->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                'participants' => []
            ];

            if ($participant = $conferenceReference->getParticipant()) {
               $json['conferences'][$key]['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conference);

            foreach($participants as $participant) {
                $json['conferences'][$key]['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            if ($lastMessage = $conferenceReference->getLastMessage()) {
                $json['conferences'][$key]['last_message'] = [
                    'uuid' => $lastMessage->getUuid(),
                    'author' => [
                        'uuid' => $lastMessage->getAuthor()->getUuid(),
                        'name' => $lastMessage->getAuthor()->getName(),
                        'public_key' => $lastMessage->getAuthor()->getPublicKey()
                    ],
                    'conference' => [
                        'uuid' => $conference->getUuid(),
                        'type' => $conference->getType(),
                        'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                        'messages_count' => $conferenceReference->getMessagesCount(),
                        'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    ],
                    'read' => $lastMessage->getRead(),
                    'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                    'date' => (float) $lastMessage->getDate()->format('U.u'),
                    'type' => $lastMessage->getType(),
                    'content' => $lastMessage->getContent(),
                    'consumed' => $lastMessage->getConsumed(),
                    'edited' => $lastMessage->getEdited()
                ];

                if ($participant = $conferenceReference->getParticipant()) {
                    $json['conferences'][$key]['last_message']['conference']['participant'] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }
            }
        }

        usort($json['conferences'], function($a, $b) {
            return $b['updated_at'] - $a['updated_at'];
        });

        foreach ($messages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'type' => $conferenceReference->getConference()->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

            foreach($participants as $participant) {
                $conference['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        foreach ($readMessages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'type' => $conferenceReference->getConference()->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

            foreach($participants as $participant) {
                $conference['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['read_messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['read_messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        foreach ($unreadMessages as $message) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $user->getUuid(),
                'conference' => $message->getConference()->getUuid()
            ]);

            $conference = [
                'uuid' => $conferenceReference->getConference()->getUuid(),
                'type' => $conferenceReference->getConference()->getType(),
                'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $conferenceReference->getMessagesCount(),
                'unread_messages_count' => $conferenceReference->getUnreadMessagesCount()
            ];

            if ($participant = $conferenceReference->getParticipant()) {
                $conference['participant'] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $participants = $this->em->getRepository(Conference::class)->getParticipants($conferenceReference->getConference());

            foreach($participants as $participant) {
                $conference['participants'][] = [
                    'uuid' => $participant->getUuid(),
                    'name' => $participant->getName(),
                    'public_key' => $participant->getPublicKey()
                ];
            }

            $json['unread_messages'][] = [
                'uuid' => $message->getUuid(),
                'author' => [
                    'uuid' => $message->getAuthor()->getUuid(),
                    'name' => $message->getAuthor()->getName(),
                    'public_key' => $message->getAuthor()->getPublicKey()
                ],
                'conference' => $conference,
                'read' => $message->getRead(),
                'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
                'date' => (float) $message->getDate()->format('U.u'),
                'type' => $message->getType(),
                'content' => $message->getContent(),
                'consumed' => $message->getConsumed(),
                'edited' => $message->getEdited()
            ];
        }

        usort($json['unread_messages'], function($a, $b) {
            return $a['date'] - $b['date'];
        });

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/start_secret_chat/{user}", methods={"POST"}, name="start_secret_chat")
     *
     * @IsGranted("ROLE_USER")
     */
    public function startSecretChat(Request $request, $user): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        $requester = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($user, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $participant = $this->em->find(User::class, $user);

        if (!$participant) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(Conference::class)->getSecretConferenceByParticipant($requester, $participant);

        if ($conference) {
            $conferenceReference = $this->em->getRepository(ConferenceReference::class)->findOneBy([
                'user' => $requester->getUuid(),
                'conference' => $conference->getUuid()
            ]);

            $json = [
                'conference' => [
                    'uuid' => $conference->getUuid(),
                    'type' => $conference->getType(),
                    'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                    'messages_count' => $conferenceReference->getMessagesCount(),
                    'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    'participant' => [
                        'uuid' => $conferenceReference->getParticipant()->getUuid(),
                        'name' => $conferenceReference->getParticipant()->getName(),
                        'public_key' => $conferenceReference->getParticipant()->getPublicKey()
                    ]
                ]
            ];

            if ($lastMessage = $conferenceReference->getLastMessage()) {
                $json['conference']['last_message'] = [
                    'uuid' => $lastMessage->getUuid(),
                    'author' => [
                        'uuid' => $lastMessage->getAuthor()->getUuid(),
                        'name' => $lastMessage->getAuthor()->getName(),
                        'public_key' => $lastMessage->getAuthor()->getPublicKey()
                    ],
                    'conference' => [
                        'uuid' => $conference->getUuid(),
                        'type' => $conference->getType(),
                        'updated_at' => (float) $conferenceReference->getUpdatedAt()->format('U.u'),
                        'messages_count' => $conferenceReference->getMessagesCount(),
                        'unread_messages_count' => $conferenceReference->getUnreadMessagesCount(),
                    ],
                    'read' => $lastMessage->getRead(),
                    'readAt' => ($lastMessage->getReadAt()) ? (float) $lastMessage->getReadAt()->format('U.u') : $lastMessage->getReadAt(),
                    'date' => (float) $lastMessage->getDate()->format('U.u'),
                    'type' => $lastMessage->getType(),
                    'content' => $lastMessage->getContent(),
                    'consumed' => $lastMessage->getConsumed(),
                    'edited' => $lastMessage->getEdited()
                ];

                if ($participant = $conferenceReference->getParticipant()) {
                    $json['conference']['last_message']['conference']['participant'] = [
                        'uuid' => $participant->getUuid(),
                        'name' => $participant->getName(),
                        'public_key' => $participant->getPublicKey()
                    ];
                }
            }

            return new JsonResponse($json);
        }

        // if (!conference)
        $conference = new Conference();
        $conference->setType(Conference::SECRET_TYPE);
        $this->em->persist($conference);

        $requesterConferenceReference = new ConferenceReference();
        $requesterConferenceReference->setUser($requester);
        $requesterConferenceReference->setConference($conference);
        $requesterConferenceReference->setParticipant($participant);
        $this->em->persist($requesterConferenceReference);

        $participantConferenceReference = new ConferenceReference();
        $participantConferenceReference->setUser($participant);
        $participantConferenceReference->setConference($conference);
        $participantConferenceReference->setParticipant($requester);
        $this->em->persist($participantConferenceReference);

        $requesterParticipant = new Participant();
        $requesterParticipant->setConference($conference);
        $requesterParticipant->setUser($requester);
        $this->em->persist($requesterParticipant);

        $participantParticipant = new Participant();
        $participantParticipant->setConference($conference);
        $participantParticipant->setUser($participant);
        $this->em->persist($participantParticipant);

        $requester->setConferencesCount($requester->getConferencesCount() + 1);
        $this->em->persist($requester);

        $participant->setConferencesCount($participant->getConferencesCount() + 1);
        $this->em->persist($participant);

        $this->em->flush();

        $json = [
            'conference' => [
                'uuid' => $conference->getUuid(),
                'type' => $conference->getType(),
                'updated_at' => (float) $requesterConferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $requesterConferenceReference->getMessagesCount(),
                'unread_messages_count' => $requesterConferenceReference->getUnreadMessagesCount(),
                'participant' => [
                    'uuid' => $requesterConferenceReference->getParticipant()->getUuid(),
                    'name' => $requesterConferenceReference->getParticipant()->getName(),
                    'public_key' => $requesterConferenceReference->getParticipant()->getPublicKey()
                ]
            ]
        ];

        return new JsonResponse($json);
    }

    /**
     * @Route("/api/messenger/secret_message/{user}", methods={"POST"}, name="send_secret_message")
     *
     * @IsGranted("ROLE_USER")
     */
    public function sendSecretMessage(Request $request, $user): Response
    {
        // x-www-urlencoded or json
        $data = empty($request->request->all()) ? json_decode($request->getContent(), $assoc = true) : $request->request->all();

        $sender = $this->getUser();

        $validator = Validation::createValidator();

        $errors = $validator->validate($user, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $receiver = $this->em->find(User::class, $user);

        if (!$receiver) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(Conference::class)->getSecretConferenceByParticipant($sender, $receiver);

        if (!$conference) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $message = new Message();
        $message->setConference($conference);
        $message->setAuthor($sender);
        $message->setType('text/plain');
        $message->setContent($data['text']);
        $message->setEdited(false);
        $this->em->persist($message);

        $senderMessageReference = new MessageReference();
        $senderMessageReference->setUser($sender);
        $senderMessageReference->setMessage($message);
        $this->em->persist($senderMessageReference);

        $receiverMessageReference = new MessageReference();
        $receiverMessageReference->setUser($receiver);
        $receiverMessageReference->setMessage($message);
        $this->em->persist($receiverMessageReference);

        $conferenceReferences = $this->em->getRepository(ConferenceReference::class)->findBy(['conference' => $conference->getUuid()]);

        $senderConferenceReference = array_values(array_filter($conferenceReferences, function ($cr) use ($sender) {
            return $cr->getUser()->getUuid() === $sender->getUuid();
        }))[0];

        $receiverConferenceReference = array_values(array_filter($conferenceReferences, function ($cr) use ($receiver) {
            return $cr->getUser()->getUuid() === $receiver->getUuid();
        }))[0];

        $senderConferenceReference->setUpdatedAt((new \DateTime()));
        $senderConferenceReference->setMessagesCount($senderConferenceReference->getMessagesCount() + 1);
        $senderConferenceReference->setLastMessage($message);
        $this->em->persist($senderConferenceReference);

        $receiverConferenceReference->setUpdatedAt((new \DateTime()));
        $receiverConferenceReference->setMessagesCount($receiverConferenceReference->getMessagesCount() + 1);
        $receiverConferenceReference->setUnreadMessagesCount($receiverConferenceReference->getUnreadMessagesCount() + 1);
        $receiverConferenceReference->setLastMessage($message);
        $this->em->persist($receiverConferenceReference);

        $this->em->flush();

        $json = [
            'uuid' => $message->getUuid(),
            'author' => [
                'uuid' => $message->getAuthor()->getUuid(),
                'name' => $message->getAuthor()->getName(),
                'public_key' => $message->getAuthor()->getPublicKey()
            ],
            'conference' => [
                'uuid' => $senderConferenceReference->getConference()->getUuid(),
                'type' => $senderConferenceReference->getConference()->getType(),
                'updated_at' => (float) $senderConferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $senderConferenceReference->getMessagesCount(),
                'unread_messages_count' => $senderConferenceReference->getUnreadMessagesCount(),
                'participant' => [
                    'uuid' => $senderConferenceReference->getParticipant()->getUuid(),
                    'name' => $senderConferenceReference->getParticipant()->getName(),
                    'public_key' => $senderConferenceReference->getParticipant()->getPublicKey()
                ]
            ],
            'read' => $message->getRead(),
            'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
            'date' => (float) $message->getDate()->format('U.u'),
            'type' => $message->getType(),
            'content' => $message->getContent(),
            'consumed' => $message->getConsumed(),
            'edited' => $message->getEdited()
        ];

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

        $validator = Validation::createValidator();

        $errors = $validator->validate($user, (new UuidConstraint()));

        if (count($errors) > 0) {
            return new Response((string) $errors, Response::HTTP_BAD_REQUEST);
        }

        $receiver = $this->em->find(User::class, $user);

        if (!$receiver) {
            return new Response('Bad Request', Response::HTTP_BAD_REQUEST);
        }

        $conference = $this->em->getRepository(Conference::class)->getConferenceByParticipant($sender, $receiver);

        if (!$conference) {
            $conference = new Conference();
            $conference->setType(Conference::PRIVATE_TYPE);
            $this->em->persist($conference);

            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($receiver);
            $this->em->persist($senderConferenceReference);

            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($receiver);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);

            $senderParticipant = new Participant();
            $senderParticipant->setConference($conference);
            $senderParticipant->setUser($sender);
            $this->em->persist($senderParticipant);

            $receiverParticipant = new Participant();
            $receiverParticipant->setConference($conference);
            $receiverParticipant->setUser($receiver);
            $this->em->persist($receiverParticipant);
        }

        $senderConferenceReference =  $senderConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $sender->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$senderConferenceReference) {
            $senderConferenceReference = new ConferenceReference();
            $senderConferenceReference->setUser($sender);
            $senderConferenceReference->setConference($conference);
            $senderConferenceReference->setParticipant($receiver);
            $this->em->persist($senderConferenceReference);

            $sender->setConferencesCount($sender->getConferencesCount() + 1);

            $this->em->persist($sender);
        }


        $receiverConferenceReference = $receiverConferenceReference ?? $this->em->getRepository(ConferenceReference::class)->findOneBy(['user' => $receiver->getUuid(), 'conference' => $conference->getUuid()]);

        if (!$receiverConferenceReference) {
            $receiverConferenceReference = new ConferenceReference();
            $receiverConferenceReference->setUser($receiver);
            $receiverConferenceReference->setConference($conference);
            $receiverConferenceReference->setParticipant($sender);
            $this->em->persist($receiverConferenceReference);

            $receiver->setConferencesCount($receiver->getConferencesCount() + 1);

            $this->em->persist($receiver);
        }

        $message = new Message();
        $message->setConference($conference);
        $message->setAuthor($sender);
        $message->setType('text/plain');
        $message->setContent($data['text']);
        $message->setEdited(false);
        $this->em->persist($message);

        $senderMessageReference = new MessageReference();
        $senderMessageReference->setUser($sender);
        $senderMessageReference->setMessage($message);
        $this->em->persist($senderMessageReference);
        
        $receiverMessageReference = new MessageReference();
        $receiverMessageReference->setUser($receiver);
        $receiverMessageReference->setMessage($message);
        $this->em->persist($receiverMessageReference);


        $senderConferenceReference->setUpdatedAt((new \DateTime()));
        $senderConferenceReference->setMessagesCount($senderConferenceReference->getMessagesCount() + 1);
        $senderConferenceReference->setLastMessage($message);
        $this->em->persist($senderConferenceReference);

        $receiverConferenceReference->setUpdatedAt((new \DateTime()));
        $receiverConferenceReference->setMessagesCount($receiverConferenceReference->getMessagesCount() + 1);
        $receiverConferenceReference->setUnreadMessagesCount($receiverConferenceReference->getUnreadMessagesCount() + 1);
        $receiverConferenceReference->setLastMessage($message);
        $this->em->persist($receiverConferenceReference);


        $this->em->flush();

        $json = [
            'uuid' => $message->getUuid(),
            'author' => [
                'uuid' => $message->getAuthor()->getUuid(),
                'name' => $message->getAuthor()->getName(),
                'public_key' => $message->getAuthor()->getPublicKey()
            ],
            'conference' => [
                'uuid' => $senderConferenceReference->getConference()->getUuid(),
                'type' => $senderConferenceReference->getConference()->getType(),
                'updated_at' => (float) $senderConferenceReference->getUpdatedAt()->format('U.u'),
                'messages_count' => $senderConferenceReference->getMessagesCount(),
                'unread_messages_count' => $senderConferenceReference->getUnreadMessagesCount(),
                'participant' => [
                    'uuid' => $senderConferenceReference->getParticipant()->getUuid(),
                    'name' => $senderConferenceReference->getParticipant()->getName(),
                    'public_key' => $senderConferenceReference->getParticipant()->getPublicKey()
                ]
            ],
            'read' => $message->getRead(),
            'readAt' => ($message->getReadAt()) ? (float) $message->getReadAt()->format('U.u') : $message->getReadAt(),
            'date' => (float) $message->getDate()->format('U.u'),
            'type' => $message->getType(),
            'content' => $message->getContent(),
            'consumed' => $message->getConsumed(),
            'edited' => $message->getEdited()
        ];

        return new JsonResponse($json);
    }
}
